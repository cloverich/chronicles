import React from "react";
import { Button, Badge } from "evergreen-ui";

interface Props {
  selected: string;
  date: string;
}

export default function DialogHeader(props: Props) {
  return (
    <>
      <Button marginRight={16}>{props.selected}</Button>
      <Badge>{props.date}</Badge>
    </>
  );
}
