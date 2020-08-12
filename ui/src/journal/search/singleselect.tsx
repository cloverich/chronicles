import React, { useState, useEffect } from "react";
import { Select } from "evergreen-ui";

interface Props {
  journals: string[];
  selected: string;
  onSelect: (j: string) => any;
}

export default function SelectJournal(props: Props) {
  if (!props.selected) {
    // Make the user pay for my programming mistakes!
    throw new Error(
      "SelectJournal received null for currently selected journal, but does not support this!"
    );
  }

  // Although, once journals have display names and such
  // may actually want IJournal interface and to pull out the display name
  const options = props.journals.map((journal) => (
    <option value={journal} key={journal}>
      {journal}
    </option>
  ));

  function onSelect(item: React.ChangeEvent<HTMLSelectElement>) {
    props.onSelect(item.target.value);
  }

  return (
    <Select
      value={props.selected}
      onChange={onSelect}
      placeholder="Select a journal"
    >
      {options}
    </Select>
  );
}
