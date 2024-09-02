import { SelectField } from "evergreen-ui";
import React from "react";

interface SelectProps<T extends string> {
  options: T[];
  selected: T;
  onSelect: (s: T) => void;
  description: string;
  label: string;
}

/**
 * Wrapper around evergreen Select to uh... make options easier.
 */
export function Select<T extends string>(props: SelectProps<T>) {
  const options = props.options.map((option) => (
    <option value={option} key={option}>
      {option}
    </option>
  ));

  // useCallback
  function onSelect(item: React.ChangeEvent<HTMLSelectElement>) {
    props.onSelect(item.target.value as T);
  }

  return (
    <SelectField
      label={props.label}
      width={256}
      value={props.selected}
      onChange={onSelect}
      description={props.description}
    >
      {options}
    </SelectField>
  );
}
