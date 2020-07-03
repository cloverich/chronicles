import { tmpdir } from "https://deno.land/std@v0.59.0/node/os.ts";
import {
  ensureDir,
  readFileStr,
  writeFileStr,
} from "https://deno.land/std@v0.59.0/fs/mod.ts";
import { FileDAO } from "./FileDAO.ts";

const tmp = Deno.cwd() + "/tmp/data/reading";
FileDAO.save(tmp, "2020-05-01", "#foo bar baz \n its the best baz!");
FileDAO.save(tmp, "2020-06-01", "#foo bar baz \n its the best baz!");
FileDAO.save(tmp, "2020-07-03", "#foo bar baz \n its the best baz!");
