import React, { useState, useEffect }  from 'react';
import { ViewState } from '../../container';
import { Pane, Button } from 'evergreen-ui';
import client from "../../client";
const { ipcRenderer } = require('electron')

interface Props extends React.PropsWithChildren<{}> {
  setView: React.Dispatch<React.SetStateAction<ViewState>>
}


export default function Preferences(props: Props) {
  const [preferences, setPreferences] = useState<any>({});
  const [loading, setLoading] = useState(true);


  // todo: Ideally this could go into a preload script
  // see the main script (electron/index) for the other half
  function openDialog() {
    setLoading(true);
    ipcRenderer.send('select-database-file');

    // todo: replace this hack with a timeout button, or implement 
    // a listener for the results (overkill imho)
    setTimeout(() => setLoading(false), 1500);
  }


  useEffect(() => {
    async function load() {
      setPreferences(await client.v2.preferences.get());
      setLoading(false);
    }

    load();
  }, [])


  return (
    <Pane>
      <Pane>
        <h4>Database</h4>
        <p>Chronicles documents are stored in a SQLite database file.</p>
        <p>This file is located at: {preferences.DATABASE_URL}</p>
        <ul>
          <li><b>To create a backup:</b> Make a copy of the database file</li>
          <li><b>To restore from a backup:</b> Use the filepicker below to point the app at your backed up file</li>
          <li><b>To change the files location:</b> <u>First</u> move the existing database file to your desired location, <u>then</u> use the filepicker to select the new location</li>
          &nbsp;then restart the app
        </ul>

        {/* todo: https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js/29105404#29105404 */}
        <Button isLoading={loading} disabled={loading} onClick={openDialog}>Select new file</Button>
        
      </Pane>
    </Pane>
  )
}