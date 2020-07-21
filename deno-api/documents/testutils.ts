import { tmpdir } from "https://deno.land/std@v0.61.0/node/os.ts";
import {
  ensureDir,
  readFileStr,
  writeFileStr,
} from "https://deno.land/std@v0.61.0/fs/mod.ts";

// Oh no not yet implemented!
// const tmp = tmpdir();
const tmp = Deno.cwd() + "/tmp/data/reading";
await ensureDir(tmp + "/2020/05");
await ensureDir(tmp + "/2020/04");
await ensureDir(tmp + "/2020/03");
