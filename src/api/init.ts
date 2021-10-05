import { server } from "./server";
import handlers from "./handlers/index";

export default async function initServer() {
  return await server(await handlers());
}
