import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import swal from 'sweetalert2';
import {
  EmailElement,
  RadioElement,
  SelectElement,
  TextareaElement,
  TextboxElement,
} from 'jsx/Form';

declare const loris: {BaseURL: string};

type ConfigOptionMap = Record<string, string>;
type ConfigOptionKey = 'dateFormat'
  | 'instruments'
  | 'logLevels'
  | 'lookupCenter'
  | 'scanTypes';

const DATA_TYPE_OPTIONS: Record<string, ConfigOptionKey> = {
  date_format: 'dateFormat',
  instrument: 'instruments',
  log_level: 'logLevels',
  lookup_center: 'lookupCenter',
  scan_type: 'scanTypes',
};

type ConfigMapping = {
  MappedValue?: string | null,
  Value?: string | null,
};

type ConfigMappingPayload = {
  mappedValue: string,
  value: string,
};

type ConfigValue = string
  | number
  | boolean
  | string[]
  | ConfigMapping
  | ConfigMapping[]
  | null;

type ConfigCategory = {
  Description: string,
  Label: string,
  Name: string,
};

type ConfigItem = {
  ID: string | number,
  Name: string,
  Label: string,
  Description: string,
  Value: ConfigValue,
  DataType: string,
  Disabled: boolean,
  AllowMultiple: boolean,
};

type ConfigOptions = {
  dateFormat: ConfigOptionMap,
  instruments: ConfigOptionMap,
  logLevels: ConfigOptionMap,
  lookupCenter: ConfigOptionMap,
  sandbox: boolean,
  scanTypes: ConfigOptionMap,
};

type CategoriesResponse = ConfigOptions & {
  categories: ConfigCategory[],
};

type CategoryResponse = {
  category: ConfigItem[],
};

type ReloadCategory = () => void;

type BaseURLProps = {
  baseURL: string,
};

type CategorySelectionProps = {
  active: string,
  categories: ConfigCategory[],
  setActive: (category: string) => void,
};

type DevNameProps = {
  enabled: boolean,
  name: string,
};

type CategoryDisplayProps = BaseURLProps & {
  category: ConfigCategory | null,
  items: ConfigItem[],
  options: ConfigOptions,
  reloadCategory: ReloadCategory,
};

type ItemDisplayProps = BaseURLProps & {
  item: ConfigItem,
  options: ConfigOptions,
  reloadCategory: ReloadCategory,
};

type MultiValueRowProps = {
  dataType: string,
  disabled: boolean,
  name: string,
  onRemove: () => void,
  onSave: (newValue: string) => void,
  options: ConfigOptions,
  value?: string,
};

type MappingInputProps = {
  disabled: boolean,
  label?: string,
  name: string,
  onSave: (newValue: ConfigMappingPayload) => void,
  value?: ConfigMappingPayload,
};

type RenderInputConfig = {
  dataType: string,
  disabled: boolean,
  label: string,
  name: string,
  onChange: (value: string) => void,
  onCommit: (value: string) => void,
  options: ConfigOptions,
  value: ConfigValue,
};

/**
 * Links to related study configuration pages and LORIS configuration docs.
 *
 * @param {BaseURLProps} props React props
 * @return {JSX}
 */
function IntroText(props: BaseURLProps): React.ReactElement {
  return (
    <div>
      <p>
        Please enter the various configuration variables into the fields below.
        For information on how to configure LORIS, please refer to the Help
        section and/or the Developer's guide.
      </p>
      <p>
        To configure study cohorts&nbsp;
        <a href={`${props.baseURL}/configuration/cohort/`}>click here</a>.
        &nbsp;To configure study projects&nbsp;
        <a href={`${props.baseURL}/configuration/project/`}>click here</a>.
      </p>
      <p>
        To configure the diagnosis trajectory of the study&nbsp;
        <a href={`${props.baseURL}/configuration/diagnosis_evolution/`}>
          click here
        </a>.
      </p>
    </div>
  );
}

/**
 * Category navigation.
 *
 * @param {CategorySelectionProps} props React props
 * @return {JSX}
 */
function CategorySelection(
  props: CategorySelectionProps
): React.ReactElement {
  const categories = props.categories.map((item) => (
    <li
      key={item.Name}
      className={item.Name === props.active ? 'active' : ''}
    >
      <a
        href={`#${item.Name}`}
        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          props.setActive(item.Name);
        }}
      >
        {item.Label}
      </a>
    </li>
  ));

  return (
    <div className="col-md-3">
      <ul className="nav nav-pills nav-stacked" role="tablist">
        {categories}
      </ul>
    </div>
  );
}

/**
 * Render the development-only config name.
 *
 * @param {DevNameProps} props React props
 * @return {?JSX}
 */
function DevName(props: DevNameProps): React.ReactElement | null {
  if (!props.enabled) {
    return null;
  }
  return <div className="config-dev-name pull-right"><i>{props.name}</i></div>;
}

/**
 * Category body.
 *
 * @param {CategoryDisplayProps} props React props
 * @return {JSX}
 */
function CategoryDisplay(props: CategoryDisplayProps): React.ReactElement {
  const rows = props.items.map((item) => (
    <ItemDisplay
      key={item.ID}
      baseURL={props.baseURL}
      item={item}
      options={props.options}
      reloadCategory={props.reloadCategory}
    />
  ));

  return (
    <div className="col-md-9 configuration-category">
      {props.category !== null && (
        <div className="configuration-category-header">
          <h2>{props.category.Label}</h2>
          <p>{props.category.Description}</p>
        </div>
      )}
      <div className="form-horizontal">
        {rows}
      </div>
    </div>
  );
}

/**
 * Single configuration setting.
 *
 * @param {ItemDisplayProps} props React props
 * @return {JSX}
 */
function ItemDisplay(props: ItemDisplayProps): React.ReactElement {
  const item = props.item;
  if (item.AllowMultiple) {
    return (
      <MultiValueInput
        baseURL={props.baseURL}
        item={item}
        options={props.options}
        reloadCategory={props.reloadCategory}
      />
    );
  }

  return (
    <div title={item.Description}>
      <SingleValueInput
        baseURL={props.baseURL}
        item={item}
        options={props.options}
        reloadCategory={props.reloadCategory}
      />
      <DevName enabled={props.options.sandbox} name={item.Name} />
    </div>
  );
}

/**
 * Single-value configuration input.
 *
 * @param {ItemDisplayProps} props React props
 * @return {JSX}
 */
function SingleValueInput(props: ItemDisplayProps): React.ReactElement {
  const [value, setValue] = useState<ConfigValue>(props.item.Value);

  useEffect(() => {
    setValue(props.item.Value);
  }, [props.item.Value]);

  /**
   * Persist a changed setting value.
   *
   * @param {string} newValue New setting value
   */
  const saveChange = (newValue: string) => {
    if (newValue === props.item.Value) {
      return;
    }
    saveSetting(props.baseURL, props.item.Name, {
      value: props.item.DataType === 'boolean'
        ? preserveBooleanStorage(newValue, props.item.Value)
        : newValue,
    })
      .then(() => props.reloadCategory())
      .catch(showSaveError);
  };

  /**
   * Save a single mapping setting.
   *
   * @param {ConfigMappingPayload} newValue New mapping payload
   */
  const saveMappingChange = (newValue: ConfigMappingPayload) => {
    if (mappingEquals(newValue, mappingFromValue(props.item.Value))) {
      return;
    }
    saveSetting(props.baseURL, props.item.Name, {value: newValue})
      .then(() => props.reloadCategory())
      .catch(showSaveError);
  };

  if (props.item.DataType === 'mapping') {
    return (
      <MappingInput
        disabled={props.item.Disabled}
        label={props.item.Label}
        name={props.item.Name}
        onSave={saveMappingChange}
        value={mappingFromValue(value)}
      />
    );
  }

  return renderInput({
    dataType: props.item.DataType,
    disabled: props.item.Disabled,
    label: props.item.Label,
    name: props.item.Name,
    onChange: setValue,
    onCommit: saveChange,
    options: props.options,
    value: value,
  });
}

/**
 * Multi-value configuration input.
 *
 * @param {ItemDisplayProps} props React props
 * @return {JSX}
 */
function MultiValueInput(props: ItemDisplayProps): React.ReactElement {
  if (props.item.DataType === 'mapping') {
    return (
      <MappingMultiValueInput
        baseURL={props.baseURL}
        item={props.item}
        options={props.options}
        reloadCategory={props.reloadCategory}
      />
    );
  }

  const values = Array.isArray(props.item.Value) ?
    props.item.Value.map(String) :
    [];
  const [isAdding, setIsAdding] = useState(false);

  /**
   * Persist the full list of values for a multi-value setting.
   *
   * @param {string[]} newValues New setting values
   */
  const saveValues = (newValues: string[]) => {
    saveSetting(props.baseURL, props.item.Name, {values: newValues})
      .then(() => {
        setIsAdding(false);
        props.reloadCategory();
      })
      .catch(showSaveError);
  };

  const rows = values.map((value, idx) => (
    <MultiValueRow
      dataType={props.item.DataType}
      disabled={props.item.Disabled}
      key={`${props.item.Name}-${idx}`}
      name={props.item.Name}
      onRemove={() => saveValues(values.filter((_el, i) => i !== idx))}
      onSave={(newValue) => {
        const newValues = [...values];
        newValues[idx] = newValue;
        saveValues(newValues);
      }}
      options={props.options}
      value={value}
    />
  ));

  if (isAdding) {
    rows.push(
      <MultiValueRow
        dataType={props.item.DataType}
        disabled={props.item.Disabled}
        key={`${props.item.Name}-new`}
        name={props.item.Name}
        onRemove={() => setIsAdding(false)}
        onSave={(newValue) => saveValues([...values, newValue])}
        options={props.options}
        value=""
      />
    );
  }

  return (
    <div className="row form-group" title={props.item.Description}>
      <div className="col-sm-3">
        <label className="col-sm-12 control-label config-name">
          {props.item.Label}
        </label>
        <DevName enabled={props.options.sandbox} name={props.item.Name} />
      </div>
      <div className="col-sm-9">
        {rows}
        {!isAdding && (
          <button
            className="btn btn-success add"
            disabled={props.item.Disabled}
            onClick={() => setIsAdding(true)}
            type="button"
          >
            <span className="glyphicon glyphicon-plus"></span> Add field
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Multi-value mapping configuration input.
 *
 * @param {ItemDisplayProps} props React props
 * @return {JSX}
 */
function MappingMultiValueInput(props: ItemDisplayProps): React.ReactElement {
  const values = mappingArrayFromValue(props.item.Value);
  const [isAdding, setIsAdding] = useState(false);

  /**
   * Save the full set of mapping rows.
   *
   * @param {ConfigMappingPayload[]} newValues New mapping rows
   */
  const saveValues = (newValues: ConfigMappingPayload[]) => {
    saveSetting(props.baseURL, props.item.Name, {values: newValues})
      .then(() => {
        setIsAdding(false);
        props.reloadCategory();
      })
      .catch(showSaveError);
  };

  return (
    <div className="row form-group" title={props.item.Description}>
      <div className="col-sm-3">
        <label className="col-sm-12 control-label config-name">
          {props.item.Label}
        </label>
        <DevName enabled={props.options.sandbox} name={props.item.Name} />
      </div>
      <div className="col-sm-9">
        <div className="configuration-mapping-card">
          <div className="configuration-mapping-card-heading">
            <span className="configuration-mapping-badge">MAP</span>
            <strong>{props.item.Label}</strong>
          </div>
          {values.map((value, idx) => (
            <div
              className="configuration-mapping-row entry"
              key={`${props.item.Name}-${idx}`}
            >
              <MappingInput
                disabled={props.item.Disabled}
                name={props.item.Name}
                onSave={(newValue) => {
                  const newValues = [...values];
                  newValues[idx] = newValue;
                  saveValues(newValues);
                }}
                value={value}
              />
              <button
                className="btn btn-remove configuration-mapping-remove"
                disabled={props.item.Disabled}
                onClick={() => saveValues(values.filter((_el, i) => i !== idx))}
                type="button"
              >
                <span className="glyphicon glyphicon-remove"></span>
              </button>
            </div>
          ))}
          {isAdding && (
            <div className="configuration-mapping-row entry">
              <MappingInput
                disabled={props.item.Disabled}
                name={props.item.Name}
                onSave={(newValue) => saveValues([...values, newValue])}
                value={{value: '', mappedValue: ''}}
              />
              <button
                className="btn btn-remove configuration-mapping-remove"
                disabled={props.item.Disabled}
                onClick={() => setIsAdding(false)}
                type="button"
              >
                <span className="glyphicon glyphicon-remove"></span>
              </button>
            </div>
          )}
          {!isAdding && (
            <button
              className="btn btn-primary add configuration-mapping-add"
              disabled={props.item.Disabled}
              onClick={() => setIsAdding(true)}
              type="button"
            >
              <span className="glyphicon glyphicon-plus"></span> Add Mapping
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Mapping value input.
 *
 * @param {MappingInputProps} props React props
 * @return {JSX}
 */
function MappingInput(props: MappingInputProps): React.ReactElement {
  const [value, setValue] = useState<ConfigMappingPayload>(
    props.value ?? {value: '', mappedValue: ''}
  );
  const valueInput = useRef<HTMLInputElement>(null);
  const mappedInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(props.value ?? {value: '', mappedValue: ''});
  }, [props.value]);

  /**
   * Update one field in local mapping input state.
   *
   * @param {keyof ConfigMappingPayload} field Field to update
   * @param {string} fieldValue New field value
   */
  const setField = (
    field: keyof ConfigMappingPayload,
    fieldValue: string
  ) => {
    setValue({...value, [field]: fieldValue});
  };

  /**
   * Save the mapping after focus leaves both fields.
   *
   * @param {keyof ConfigMappingPayload} field Field to save
   * @param {string} fieldValue New field value
   */
  const saveField = (
    field: keyof ConfigMappingPayload,
    fieldValue: string
  ) => {
    const nextValue = {...value, [field]: fieldValue};
    window.setTimeout(() => {
      if (
        document.activeElement !== valueInput.current
        && document.activeElement !== mappedInput.current
      ) {
        props.onSave(nextValue);
      }
    }, 0);
  };

  const inputs = (
    <div className="configuration-mapping-fields">
      <input
        aria-label="Value"
        className="form-control configuration-mapping-value"
        disabled={props.disabled}
        name={`${props.name}-value`}
        onBlur={(e) => saveField('value', e.currentTarget.value)}
        onChange={(e) => setField('value', e.currentTarget.value)}
        ref={valueInput}
        type="text"
        value={value.value}
      />
      <input
        aria-label="Mapped value"
        className="form-control configuration-mapping-mapped-value"
        disabled={props.disabled}
        name={`${props.name}-mapped-value`}
        onBlur={(e) => saveField('mappedValue', e.currentTarget.value)}
        onChange={(e) => setField('mappedValue', e.currentTarget.value)}
        ref={mappedInput}
        type="text"
        value={value.mappedValue}
      />
    </div>
  );

  if (props.label === undefined) {
    return inputs;
  }

  return (
    <div className="row form-group">
      <label className="col-sm-3 control-label" htmlFor={`${props.name}-value`}>
        {props.label}
      </label>
      <div className="col-sm-9">
        {inputs}
      </div>
    </div>
  );
}

/**
 * Normalize a mapping value returned by the API.
 *
 * @param {ConfigValue} value API config value
 * @return {ConfigMappingPayload}
 */
function mappingFromValue(value: ConfigValue): ConfigMappingPayload {
  if (isConfigMapping(value)) {
    return {
      mappedValue: String(value.MappedValue ?? ''),
      value: String(value.Value ?? ''),
    };
  }
  return {value: '', mappedValue: ''};
}

/**
 * Normalize mapping rows returned by the API.
 *
 * @param {ConfigValue} value API config value
 * @return {ConfigMappingPayload[]}
 */
function mappingArrayFromValue(value: ConfigValue): ConfigMappingPayload[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isConfigMapping).map(mappingFromValue);
}

/**
 * Check whether a value is a mapping API object.
 *
 * @param {unknown} value Value to check
 * @return {boolean}
 */
function isConfigMapping(value: unknown): value is ConfigMapping {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && ('Value' in value || 'MappedValue' in value);
}

/**
 * Compare mapping payloads.
 *
 * @param {ConfigMappingPayload} a First value
 * @param {ConfigMappingPayload} b Second value
 * @return {boolean}
 */
function mappingEquals(
  a: ConfigMappingPayload,
  b: ConfigMappingPayload
): boolean {
  return a.value === b.value && a.mappedValue === b.mappedValue;
}

/**
 * One row in a multi-value input.
 *
 * @param {MultiValueRowProps} props React props
 * @return {JSX}
 */
function MultiValueRow({
  dataType,
  disabled,
  name,
  onRemove,
  onSave,
  options,
  value: initialValue = '',
}: MultiValueRowProps): React.ReactElement {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <div className="input-group entry">
      {renderInput({
        dataType: dataType,
        disabled: disabled,
        label: '',
        name: name,
        onChange: setValue,
        onCommit: onSave,
        options: options,
        value: value,
      })}
      <div className="input-group-btn">
        <button
          className="btn btn-danger btn-remove"
          disabled={disabled}
          onClick={onRemove}
          type="button"
        >
          <span className="glyphicon glyphicon-remove"></span>&nbsp;
        </button>
      </div>
    </div>
  );
}

/**
 * Render the proper form element for a config data type.
 *
 * @param {RenderInputConfig} config Render config
 * @return {JSX}
 */
function renderInput(config: RenderInputConfig): React.ReactElement {
  const value = String(config.value ?? '');

  switch (config.dataType) {
  case 'boolean':
    return (
      <RadioElement
        checked={booleanRadioValue(config.value)}
        disabled={config.disabled}
        label={config.label}
        name={config.name}
        onUserInput={(_name: string, inputValue: string) => {
          config.onCommit(inputValue);
        }}
        options={booleanRadioOptions(config.value)}
      />
    );
  case 'date_format':
  case 'instrument':
  case 'log_level':
  case 'lookup_center':
  case 'scan_type':
    return (
      <SelectElement
        disabled={config.disabled}
        label={config.label}
        name={config.name}
        onUserInput={(_name: string, inputValue: string) => {
          config.onCommit(inputValue);
        }}
        options={config.options[DATA_TYPE_OPTIONS[config.dataType]]}
        value={value}
      />
    );
  case 'email':
    return (
      <EmailElement
        disabled={config.disabled}
        label={config.label}
        name={config.name}
        onUserBlur={(_name: string, inputValue: string) => {
          config.onCommit(inputValue);
        }}
        onUserInput={(_name: string, inputValue: string) => {
          config.onChange(inputValue);
        }}
        value={value}
      />
    );
  case 'textarea':
    return (
      <TextareaElement
        disabled={config.disabled}
        label={config.label}
        name={config.name}
        onUserBlur={(_name: string, inputValue: string) => {
          config.onCommit(inputValue);
        }}
        onUserInput={(_name: string, inputValue: string) => {
          config.onChange(inputValue);
        }}
        value={value}
      />
    );
  case 'path':
  case 'text':
  case 'web_path':
    return (
      <TextboxElement
        disabled={config.disabled}
        label={config.label}
        name={config.name}
        onUserBlur={(_name: string, inputValue: string) => {
          config.onCommit(inputValue);
        }}
        onUserInput={(_name: string, inputValue: string) => {
          config.onChange(inputValue);
        }}
        value={value}
      />
    );
  default:
    return (
      <div className="text-danger">Unsupported type {config.dataType}</div>
    );
  }
}

/**
 * Return the radio value matching the stored boolean representation.
 *
 * @param {ConfigValue} value Stored boolean value
 * @return {string}
 */
function booleanRadioValue(value: ConfigValue): string {
  if (value === '1' || value === 1) {
    return '1';
  }
  if (value === '0' || value === 0) {
    return '0';
  }
  if (value === true || value === 'true') {
    return 'true';
  }
  return 'false';
}

/**
 * Preserve legacy 1/0 boolean storage when a setting already uses it.
 *
 * @param {ConfigValue} value Stored boolean value
 * @return {object}
 */
function booleanRadioOptions(value: ConfigValue): ConfigOptionMap {
  if (value === '1' || value === '0' || value === 1 || value === 0) {
    return {'1': 'Yes', '0': 'No'};
  }
  return {'true': 'Yes', 'false': 'No'};
}

/**
 * Keep existing 1/0 boolean settings in their current storage format.
 *
 * @param {string} newValue New radio value
 * @param {ConfigValue} currentValue Current stored value
 * @return {string}
 */
function preserveBooleanStorage(
  newValue: string,
  currentValue: ConfigValue
): string {
  if (currentValue === '1' || currentValue === '0') {
    return newValue === 'true' ? '1' : newValue === 'false' ? '0' : newValue;
  }
  if (currentValue === 1 || currentValue === 0) {
    return newValue === 'true' ? '1' : newValue === 'false' ? '0' : newValue;
  }
  return newValue;
}

/**
 * Save a configuration setting.
 *
 * @param {string} baseURL LORIS base URL
 * @param {string} setting Setting name
 * @param {object} payload JSON payload
 * @return {Promise<void>}
 */
function saveSetting(
  baseURL: string,
  setting: string,
  payload: Record<string, unknown>
): Promise<void> {
  return fetch(`${baseURL}/configuration/setting/${setting}`, {
    body: JSON.stringify({
      setting: setting,
      ...payload,
    }),
    credentials: 'same-origin',
    method: 'PUT',
  }).then((resp) => {
    if (!resp.ok) {
      throw new Error(`Could not save ${setting}`);
    }
    return resp.json();
  }).then((): void => {
    void swal.fire('Success!', `Successfully saved ${setting}`, 'success');
  });
}

/**
 * Show save errors consistently.
 *
 * @param {Error} error Error object
 * @return {void}
 */
function showSaveError(error: Error): void {
  void swal.fire('Error', error.toString(), 'error');
}

/**
 * Entrypoint for the configuration module.
 *
 * @param {BaseURLProps} props React props
 * @return {JSX}
 */
function ConfigurationIndex(props: BaseURLProps): React.ReactElement {
  const [activeCategory, setActiveCategory] = useState('');
  const [categories, setCategories] = useState<ConfigCategory[]>([]);
  const [categoryItems, setCategoryItems] = useState<ConfigItem[]>([]);
  const [options, setOptions] = useState<ConfigOptions>({
    dateFormat: {},
    instruments: {},
    logLevels: {},
    lookupCenter: {},
    sandbox: false,
    scanTypes: {},
  });
  const [reloadKey, setReloadKey] = useState(0);
  const activeCategoryData = categories.find(
    (category) => category.Name === activeCategory
  ) ?? null;

  useEffect(() => {
    fetch(`${props.baseURL}/configuration/categories`, {
      credentials: 'same-origin',
    }).then((resp) => {
      if (!resp.ok) {
        throw new Error('Could not retrieve configuration categories');
      }
      return resp.json() as Promise<CategoriesResponse>;
    }).then((data) => {
      setCategories(data.categories);
      setOptions({
        dateFormat: data.dateFormat,
        instruments: data.instruments,
        logLevels: data.logLevels,
        lookupCenter: data.lookupCenter,
        sandbox: data.sandbox,
        scanTypes: data.scanTypes,
      });
      if (data.categories.length > 0) {
        setActiveCategory(data.categories[0].Name);
      }
    }).catch((error) => {
      showSaveError(error);
    });
  }, [props.baseURL]);

  useEffect(() => {
    if (activeCategory === '') {
      return;
    }
    fetch(`${props.baseURL}/configuration/categories/${activeCategory}`, {
      credentials: 'same-origin',
    }).then((resp) => {
      if (!resp.ok) {
        throw new Error(`Could not retrieve category ${activeCategory}`);
      }
      return resp.json() as Promise<CategoryResponse>;
    }).then((data) => {
      setCategoryItems(data.category);
    }).catch((error) => {
      showSaveError(error);
    });
  }, [activeCategory, props.baseURL, reloadKey]);

  return (
    <div>
      <IntroText baseURL={props.baseURL} />
      <div className="row">
        <CategorySelection
          active={activeCategory}
          categories={categories}
          setActive={setActiveCategory}
        />
        <CategoryDisplay
          baseURL={props.baseURL}
          category={activeCategoryData}
          items={categoryItems}
          options={options}
          reloadCategory={() => setReloadKey((current) => current + 1)}
        />
      </div>
    </div>
  );
}

window.addEventListener('load', () => {
  const workspace = document.getElementById('lorisworkspace');
  if (workspace === null) {
    throw new Error('Could not find lorisworkspace root');
  }
  const root = createRoot(workspace);
  root.render(<ConfigurationIndex baseURL={loris.BaseURL} />);
});
