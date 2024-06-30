import React from "react";
import { observer } from "mobx-react-lite";
import { Pane, Button, Alert } from "evergreen-ui";
import { css } from "emotion";
import { useNavigate } from "react-router-dom";

export interface LoadingComponentProps {
  error?: Error | null;
}

export const placeholderDate = new Date().toISOString().slice(0, 10);
export const noop: any = () => {};

export const EditLoadingComponent = observer((props: LoadingComponentProps) => {
  const navigate = useNavigate();

  return (
    <Pane>
      <a onClick={() => navigate("/documents")}>Back</a>
      <Pane marginTop={24}>
        <div
          className={css`
            display: flex;
            justify-content: flex-start;
          `}
        >
          <div
            className={css`
              margin-right: 4px;
            `}
          >
            {placeholderDate}/
          </div>
          <span
            className={css`
              border-bottom: 1px dotted purple;
              color: purple;
              cursor: pointer;
            `}
          >
            Loading...
          </span>
        </div>
        <div
          className={css`
            margin-bottom: 16px;
            margin-top: 16px;
          `}
        >
          <input
            type="text"
            name="title"
            className={css`
              font-size: 1.5em;
              border: none;
              width: 100%;
              &:focus {
                outline: none;
              }
            `}
            placeholder=""
            disabled={true}
          />
        </div>

        {/* note: its not actually clear to me whether toJS is necessary here. */}
        <Pane></Pane>
        {props.error && (
          <Alert intent="danger" title="Error loading documents">
            {JSON.stringify(props.error)}
          </Alert>
        )}

        <Pane marginTop={24}>
          <Button onClick={noop} disabled={true} isLoading={true}>
            Save
          </Button>
        </Pane>
      </Pane>
    </Pane>
  );
});
