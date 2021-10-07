import { JournalsClient } from "./journals";
import { DocumentsClient, GetDocumentResponse } from "./documents";
import { PreferencesClient } from "./preferences";
import { FilesClient } from "./files";
import ky from "ky-universal";
import DB from "better-sqlite3";

import Store from "electron-store";
const settings = new Store({
  name: "settings",
});

// todo: validation, put this somewhere proper
const db = DB(settings.get("DATABASE_URL") as string);

export { GetDocumentResponse } from "./documents";

export interface Client {
  journals: JournalsClient;
  documents: DocumentsClient;
  preferences: PreferencesClient;
  files: FilesClient;
}

export function configure(urlBase: string): Client {
  // todo: remove ky
  const myky = ky.extend({
    prefixUrl: urlBase,
    hooks: {
      afterResponse: [
        // Or retry with a fresh token on a 403 error
        async (request, options, response) => {
          if (response.status === 400) {
            // Clone so downstream consumers (just tests for now) don't need
            // modified, since body may only be "consumed" once.
            // todo: error handling strategy
            console.log(await response.clone().json());
          }

          return response;
        },
      ],
    },
  });

  return {
    journals: new JournalsClient(db),
    documents: new DocumentsClient(myky, db),
    preferences: new PreferencesClient(myky, settings),
    files: new FilesClient(myky, settings),
  };
}

// https://github.com/sindresorhus/ky#hooksafterresponse
// This hook enables you to read and optionally modify the response.
// The hook function receives normalized request, options, and a clone of the response as arguments.
// The return value of the hook function will be used by Ky as the response object if it's an instance of Response.
// Response {
//   size: 0,
//   [Symbol(Body internals)]: {
//     body: PassThrough {
//       _readableState: [ReadableState],
//       readable: true,
//       _events: [Object: null prototype],
//       _eventsCount: 5,
//       _maxListeners: undefined,
//       _writableState: [WritableState],
//       writable: true,
//       allowHalfOpen: true,
//       _transformState: [Object],
//       [Symbol(kCapture)]: false
//     },
//     boundary: null,
//     disturbed: false,
//     error: null
//   },
//   [Symbol(Response internals)]: {
//     url: 'http://localhost:57601/v2/journals',
//     status: 400,
//     statusText: 'Bad Request',
//     headers: {
//       'access-control-allow-headers': '*',
//       'access-control-allow-methods': 'POST, PUT, GET, OPTIONS, DELETE',
//       'access-control-allow-origin': '*',
//       connection: 'close',
//       'content-length': '31',
//       'content-type': 'application/json; charset=utf-8',
//       date: 'Wed, 11 Aug 2021 12:02:19 GMT',
//       'x-response-time': '42ms'
//     },
//     counter: undefined,
//     highWaterMark: undefined
//   }
// }
