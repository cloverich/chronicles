import React from "react";
import { Pane } from "evergreen-ui";
import TagSearch from "./search";
import { Link } from 'react-router-dom';
import { SearchV2Store } from './SearchStore';


interface Props {
    store: SearchV2Store;
    children: any;
    empty?: boolean;
}

export function Layout(props: Props) {
    return (
        <Pane>
            <Pane marginBottom={8}>
                <TagSearch store={props.store} />
            </Pane>
            <Pane>
                <Link to="/edit/new">
                    Create new
                </Link>
            </Pane>
            <Pane marginTop={24}>{props.children}</Pane>
        </Pane>
    );
}