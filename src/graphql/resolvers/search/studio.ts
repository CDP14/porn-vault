import Studio from "../../../types/studio";
import * as logger from "../../../logger";
import { searchStudios } from "../../../search/studio";

export async function getStudios(
  _,
  { query, seed }: { query?: string; seed?: string }
) {
  try {
    const timeNow = +new Date();
    const result = await searchStudios(query || "", seed);

    logger.log(
      `Search results: ${result.max_items} hits found in ${
        (Date.now() - timeNow) / 1000
      }s`
    );

    const studios = await Promise.all(
      result.items.map((id) => {
        return Studio.getById(id);
      })
    );
    logger.log(`Search done in ${(Date.now() - timeNow) / 1000}s.`);

    return {
      numItems: result.max_items,
      numPages: result.num_pages,
      items: studios.filter(Boolean),
    };
  } catch (error) {
    logger.error(error);
  }
}
