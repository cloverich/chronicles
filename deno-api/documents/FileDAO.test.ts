import { readFileStr, emptyDir } from "https://deno.land/std@v0.61.0/fs/mod.ts";
import { FileDAO } from "./FileDAO.ts";
import {
  assertEquals,
  assertStringContains,
  assertArrayContains,
  assert,
  assertThrowsAsync,
} from "https://deno.land/std@v0.61.0/testing/asserts.ts";

// node/os.tmpdir() not yet implemented!
const tmpdir = Deno.cwd() + "/tmp/data/reading";
await emptyDir(tmpdir);

Deno.test("FileDAO.save", async () => {
  await emptyDir(tmpdir);
  const content = "#foo bar baz \n its the best baz!";

  async function makeAndAssert(dir: string, date: string, content: string) {
    await FileDAO.save(dir, date, content);
    const backout = await readFileStr(
      dir + "/" + date.slice(0, 4) + "/" + date.slice(5, 7) + "/" + date + ".md"
    );
    assertEquals(backout, content);
  }

  await makeAndAssert(tmpdir, "2020-05-01", content);
  await makeAndAssert(tmpdir, "2020-06-01", content);
  await makeAndAssert(tmpdir, "2020-07-01", content);
});

Deno.test("FileDAO.save overwrites file", async () => {
  await emptyDir(tmpdir);
  const content = "#foo bar baz \n its the best baz!";

  async function makeAndAssert(dir: string, date: string, content: string) {
    await FileDAO.save(dir, date, content);
    const backout = await readFileStr(
      dir + "/" + date.slice(0, 4) + "/" + date.slice(5, 7) + "/" + date + ".md"
    );
    assertEquals(backout, content);
  }

  await makeAndAssert(tmpdir, "2020-05-01", content);
  await makeAndAssert(tmpdir, "2020-05-01", "#content /n is different");
});

Deno.test("FileDAO.save requires non-empty string", async () => {
  await emptyDir(tmpdir);
  await assertThrowsAsync(() => FileDAO.save(tmpdir, "2020-05-01", ""));
});

Deno.test("FileDAO.save verifies date format", async () => {
  await emptyDir(tmpdir);
  const content = "#foo bar baz \n its the best baz!";
  await assertThrowsAsync(() => FileDAO.save(tmpdir, "20200-05-01", content));
  await assertThrowsAsync(() => FileDAO.save(tmpdir, "2020-051-01", content));
  await assertThrowsAsync(() => FileDAO.save(tmpdir, "20200501", content));
});
