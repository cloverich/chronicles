import React, { useState, useEffect } from "react";
import { Select } from "evergreen-ui";
import { SearchProps } from "./searchprops";

export default function SelectJournal(props: SearchProps) {
  const selected = props?.query?.journals?.length
    ? props.query.journals[0]
    : "";

  const options = props.journals.map((j) => (
    <option value={j.name} key={j.name}>
      {j.name}
    </option>
  ));

  function onSelect(item: React.ChangeEvent<HTMLSelectElement>) {
    props.setQuery({
      journals: [item.target.value],
      nodeMatch: undefined,
    });
  }

  return (
    <Select value={selected} onChange={onSelect} placeholder="Select a journal">
      <option value=""></option>
      {options}
    </Select>
  );
}
