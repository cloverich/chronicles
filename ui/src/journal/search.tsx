import React from "react";
import { SelectMenu, SelectMenuItem, Button } from "evergreen-ui";
import { ContentState, JournalsState } from "../hooks";

export type SearchProps =
  & Pick<ContentState, "loading" | "query" | "setQuery">
  & Pick<JournalsState, "journals">;

export default function Search(props: SearchProps) {
  const options = props.journals.map((j) => ({ label: j.name, value: j.name }));
  const selected = props.query?.journals || [];

  function onSelect(item: SelectMenuItem) {
    if (props.query) {
      props.setQuery({
        journals: props.query.journals
          ? props.query.journals.concat(item.value as string)
          : [item.value as string],
        nodeMatch: props.query?.nodeMatch,
      });
    } else {
      props.setQuery({
        journals: [item.value as string],
        nodeMatch: undefined,
      });
    }
  }

  function onDeselect(item: SelectMenuItem) {
    props.setQuery({
      journals: props.query?.journals?.filter((j) => j !== item.value) || [],
      nodeMatch: props.query?.nodeMatch,
    });
  }

  return (
    <SelectMenu
      isMultiSelect
      title="Select A journal!"
      options={options}
      selected={selected}
      onSelect={onSelect}
      onDeselect={onDeselect}
    >
      <Button>{selected.length > 0 ? selected : "Select journal(s)"}</Button>
    </SelectMenu>
  );
}
