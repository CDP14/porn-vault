import Scene from "../types/scene";
import Studio from "../types/studio";
import * as logger from "../logger";
import ora from "ora";
import extractQueryOptions from "../query_extractor";
import argv from "../args";
import SceneView from "../types/watch";
import { Gianna } from "./internal/index";
import { mapAsync } from "../types/utility";
import {
  filterFavorites,
  filterBookmark,
  filterRating,
  filterInclude,
  filterExclude,
  filterActors,
  filterStudios,
  filterDuration,
} from "./common";

const PAGE_SIZE = 24;

export let index!: Gianna.Index<ISceneSearchDoc>;

export interface ISceneSearchDoc {
  _id: string;
  addedOn: number;
  name: string;
  actors: string[];
  labels: string[];
  actorNames: string[];
  labelNames: string[];
  rating: number;
  bookmark: number | null;
  favorite: boolean;
  numViews: number;
  releaseDate: number | null;
  duration: number | null;
  studio: string | null;
  studioName: string | null;
  resolution: number | null;
  size: number | null;
  score: number;
}

async function createSceneSearchDoc(scene: Scene): Promise<ISceneSearchDoc> {
  const labels = await Scene.getLabels(scene);
  const actors = await Scene.getActors(scene);
  const numViews = await SceneView.getCount(scene._id);
  const studio = scene.studio ? await Studio.getById(scene.studio, true) : null;

  return {
    _id: scene._id,
    addedOn: scene.addedOn,
    name: scene.name,
    labels: labels.map((l) => l._id),
    actors: actors.map((a) => a._id),
    actorNames: actors.map((a) => [a.name, ...a.aliases]).flat(),
    labelNames: labels.map((l) => [l.name, ...l.aliases]).flat(),
    rating: scene.rating,
    bookmark: scene.bookmark,
    favorite: scene.favorite,
    numViews,
    duration: scene.meta.duration,
    releaseDate: scene.releaseDate,
    studio: scene.studio,
    resolution: scene.meta.dimensions ? scene.meta.dimensions.height : 0,
    size: scene.meta.size,
    studioName: studio ? studio.name : null,
    score: Scene.calculateScore(scene, numViews),
  };
}

const FIELDS = [
  "name",
  "labels",
  "actors",
  "studioName",
  "actorNames",
  "labelNames",
];

async function addSceneSearchDocs(docs: ISceneSearchDoc[]) {
  logger.log(`Indexing ${docs.length} items...`);
  const timeNow = +new Date();
  const res = await index.index(docs);
  logger.log(`Gianna indexing done in ${(Date.now() - timeNow) / 1000}s`);
  return res;
}

export async function updateScenes(scenes: Scene[]) {
  return index.update(await mapAsync(scenes, createSceneSearchDoc));
}

export async function indexScenes(scenes: Scene[]) {
  let docs = [] as ISceneSearchDoc[];
  let numItems = 0;
  for (const scene of scenes) {
    docs.push(await createSceneSearchDoc(scene));

    if (docs.length == (argv["index-slice-size"] || 5000)) {
      await addSceneSearchDocs(docs);
      numItems += docs.length;
      docs = [];
    }
  }
  if (docs.length) {
    await addSceneSearchDocs(docs);
    numItems += docs.length;
  }
  docs = [];
  return numItems;
}

export async function searchScenes(query: string, shuffleSeed = "default") {
  const options = extractQueryOptions(query);
  logger.log(`Searching scenes for '${options.query}'...`);

  let sort = undefined as Gianna.ISortOptions | undefined;
  let filter = {
    type: "AND",
    children: [],
  } as Gianna.IFilterTreeGrouping;

  filterDuration(filter, options);
  filterFavorites(filter, options);
  filterBookmark(filter, options);
  filterRating(filter, options);
  filterInclude(filter, options);
  filterExclude(filter, options);
  filterActors(filter, options);
  filterStudios(filter, options);

  if (options.sortBy) {
    if (options.sortBy === "$shuffle") {
      sort = {
        sort_by: "$shuffle",
        sort_asc: false,
        sort_type: shuffleSeed,
      };
    } else {
      const sortType = {
        addedOn: "number",
        name: "string",
        rating: "number",
        bookmark: "number",
        numViews: "number",
        releaseDate: "number",
        duration: "number",
        resolution: "number",
        size: "number",
      }[options.sortBy];
      sort = {
        sort_by: options.sortBy,
        sort_asc: options.sortDir === "asc",
        sort_type: sortType,
      };
    }
  }

  return index.search({
    query: options.query,
    skip: options.skip || options.page * 24,
    take: options.take || options.take || PAGE_SIZE,
    sort,
    filter,
  });
}

export async function buildSceneIndex() {
  index = await Gianna.createIndex("scenes", FIELDS);

  const timeNow = +new Date();
  const loader = ora("Building scene index...").start();

  const res = await indexScenes(await Scene.getAll());

  loader.succeed(`Build done in ${(Date.now() - timeNow) / 1000}s.`);
  logger.log(`Index size: ${res} items`);

  return index;
}
