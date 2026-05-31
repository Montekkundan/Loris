<?php declare(strict_types=1);

namespace LORIS\configuration;

use \Psr\Http\Message\ServerRequestInterface;
use \Psr\Http\Message\ResponseInterface;
use \Psr\Http\Server\RequestHandlerInterface;

/**
 * JSON endpoint for configuration categories and category settings.
 *
 * @license http://www.gnu.org/licenses/gpl-3.0.txt GPLv3
 */
class Categories extends \NDB_Page implements RequestHandlerInterface
{
    /**
     * Keep JSON responses undecorated.
     *
     * @param ServerRequestInterface  $request The PSR7 request
     * @param RequestHandlerInterface $handler The request handler
     *
     * @return ResponseInterface
     */
    public function process(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler
    ) : ResponseInterface {
        return $handler->handle($request);
    }

    /**
     * Returns true if user has access to this endpoint.
     *
     * @param \User $user The user whose access is being checked
     *
     * @return bool
     */
    #[\Override]
    public function isAccessibleBy(\User $user) : bool
    {
        return $user->hasPermission('config');
    }

    /**
     * Handle /configuration/categories and /configuration/categories/<name>.
     *
     * @param ServerRequestInterface $request The incoming request
     *
     * @return ResponseInterface
     */
    public function handle(ServerRequestInterface $request) : ResponseInterface
    {
        $path = trim($request->getAttribute("unhandledURI")->getPath(), "/");
        if ($path === '' || $path === 'categories') {
            return $this->getCategoryList();
        }

        $matches = [];
        if (preg_match('/^categories\/([[:alnum:]_]+)$/', $path, $matches) === 1) {
            return $this->getCategory($matches[1]);
        }

        return new \LORIS\Http\Response\JSON\NotFound();
    }

    /**
     * Gets a list of configuration categories and supporting option sets.
     *
     * @return ResponseInterface
     */
    public function getCategoryList() : ResponseInterface
    {
        $DB = $this->loris->getDatabaseConnection();
        $parentConfigItems = $DB->pselect(
            "SELECT Label, Name
             FROM ConfigCategories
             WHERE Visible=1
             ORDER BY OrderNumber",
            []
        );

        $scans     = $DB->pselect(
            "SELECT MriScanTypeName FROM mri_scan_type",
            []
        );
        $scanTypes = ['' => ''];
        foreach ($scans as $type) {
            $val = $type['MriScanTypeName'];
            $scanTypes[$val] = $val;
        }

        $instruments     = \NDB_BVL_Instrument::getInstrumentNamesList($this->loris);
        $instruments[''] = '';

        return new \LORIS\Http\Response\JSON\OK(
            [
                'categories'   => iterator_to_array($parentConfigItems),
                'dateFormat'   => [
                    ''    => '',
                    'Ymd' => 'Ymd (EX: 2015-12-28)',
                    'Ym'  => 'Ym (EX: 2015-12)',
                ],
                'instruments'  => $instruments,
                'logLevels'    => [
                    'none'      => 'None',
                    'debug'     => 'Debug',
                    'info'      => 'Info',
                    'notice'    => 'Notice',
                    'warning'   => 'Warning',
                    'error'     => 'Error',
                    'critical'  => 'Critical',
                    'alert'     => 'Alert',
                    'emergency' => 'Emergency',
                ],
                'lookupCenter' => [
                    ''            => '',
                    'PatientID'   => 'PatientID',
                    'PatientName' => 'PatientName',
                ],
                'sandbox'      => boolval(
                    \NDB_Config::singleton()->getSetting("sandbox")
                ),
                'scanTypes'    => $scanTypes,
            ]
        );
    }

    /**
     * Gets a category of configuration settings.
     *
     * @param string $category The category name to retrieve
     *
     * @return ResponseInterface
     */
    public function getCategory(string $category) : ResponseInterface
    {
        $DB = $this->loris->getDatabaseConnection();

        $categoryID = $DB->pselectOneInt(
            "SELECT ID
             FROM ConfigCategories
             WHERE Visible=1 AND Name=:cat",
            ['cat' => $category]
        );
        if ($categoryID === null) {
            return new \LORIS\Http\Response\JSON\NotFound();
        }

        $configs = iterator_to_array(
            $DB->pselect(
                "SELECT *
                 FROM ConfigSettings
                 WHERE Visible=1 AND CategoryID=:cid
                 ORDER BY Parent, OrderNumber",
                ['cid' => $categoryID]
            )
        );

        $config = \NDB_Config::singleton();
        $childrenByParent = [];
        foreach ($configs as $setting) {
            $setting = $this->_formatSetting($setting, $DB, $config);
            $parent  = $setting['Parent'] === null
                ? 'root'
                : strval($setting['Parent']);
            $childrenByParent[$parent][] = $setting;
        }

        return new \LORIS\Http\Response\JSON\OK(
            ['category' => $this->_buildSettingTree($childrenByParent, null)]
        );
    }

    /**
     * Build a tree from settings grouped by parent ID.
     *
     * @param array    $childrenByParent Settings grouped by parent
     * @param int|null $parentID         Parent ID to build from
     *
     * @return array
     */
    private function _buildSettingTree(
        array $childrenByParent,
        ?int $parentID
    ) : array {
        $key      = $parentID === null ? 'root' : strval($parentID);
        $settings = [];
        foreach ($childrenByParent[$key] ?? [] as $setting) {
            $setting['Children'] = $this->_buildSettingTree(
                $childrenByParent,
                intval($setting['ID'])
            );
            $settings[] = $setting;
        }
        return $settings;
    }

    /**
     * Add value metadata to a setting row.
     *
     * @param array       $setting The setting row
     * @param \Database   $DB      Database handle
     * @param \NDB_Config $config  Runtime config
     *
     * @return array
     */
    private function _formatSetting(
        array $setting,
        \Database $DB,
        \NDB_Config $config
    ) : array {
        $setting['AllowMultiple'] = boolval($setting['AllowMultiple']);
        if ($setting['DataType'] === null) {
            $setting['Disabled'] = false;
            $setting['Value']    = '';
            return $setting;
        }

        $settingName = strval($setting['Name']);
        try {
            $valueFromXML        = $config->getSettingFromXML($settingName);
            $setting['Disabled'] = true;
            if ($setting['DataType'] === 'mapping') {
                $setting['Value'] = $this->_formatMappingValue(
                    $setting['AllowMultiple'],
                    (array) $valueFromXML
                );
            } else {
                $setting['Value'] = $setting['AllowMultiple'] === true
                    ? (array) $valueFromXML
                    : $valueFromXML;
            }
        } catch (\ConfigurationException $e) {
            $setting['Disabled'] = false;
            $value               = $this->_getDatabaseValue($setting, $DB);

            if ($setting['DataType'] === 'mapping') {
                $setting['Value'] = $this->_formatMappingValue(
                    $setting['AllowMultiple'],
                    $value
                );
            } else if ($setting['AllowMultiple']) {
                $setting['Value'] = array_column($value, 'Value');
            } else if (count($value) === 1) {
                $setting['Value'] = $value[0]['Value'];
            } else {
                $setting['Value'] = '';
            }
        }
        return $setting;
    }

    /**
     * Load setting values from the database.
     *
     * @param array     $setting The setting row
     * @param \Database $DB      Database handle
     *
     * @return array
     */
    private function _getDatabaseValue(array $setting, \Database $DB) : array
    {
        if ($setting['DataType'] === 'mapping') {
            return iterator_to_array(
                $DB->pselect(
                    "SELECT c.ID, c.Value, cm.Value AS MappedValue
                     FROM Config c
                     LEFT JOIN ConfigMappings cm ON cm.ConfigID=c.ID
                     WHERE c.ConfigID=:ID
                     ORDER BY c.ID",
                    ['ID' => $setting['ID']]
                )
            );
        }

        return iterator_to_array(
            $DB->pselect(
                "SELECT ID, Value FROM Config WHERE ConfigID=:ID",
                ['ID' => $setting['ID']]
            )
        );
    }

    /**
     * Format mapping values for the React configuration UI.
     *
     * @param bool  $allowMultiple Whether the setting accepts multiple mappings
     * @param array $values        Mapping rows
     *
     * @return array
     */
    private function _formatMappingValue(bool $allowMultiple, array $values) : array
    {
        $mappings = array_map(
            function ($value) {
                if (!is_array($value)) {
                    return [
                        'Value'       => strval($value),
                        'MappedValue' => '',
                    ];
                }
                return [
                    'Value'       => isset($value['Value'])
                        ? strval($value['Value'])
                        : '',
                    'MappedValue' => isset($value['MappedValue'])
                        ? strval($value['MappedValue'])
                        : '',
                ];
            },
            $values
        );

        if ($allowMultiple) {
            return $mappings;
        }
        return $mappings[0] ?? ['Value' => '', 'MappedValue' => ''];
    }
}
