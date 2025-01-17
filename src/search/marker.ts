import ora from "ora";

import argv from "../args";
import extractQueryOptions from "../query_extractor";
import Marker from "../types/marker";
import Scene from "../types/scene";
import { mapAsync } from "../utils/async";
import * as logger from "../utils/logger";
import {
  filterBookmark,
  filterExclude,
  filterFavorites,
  filterInclude,
  filterRating,
} from "./common";
import { Gianna } from "./internal/index";

const PAGE_SIZE = 24;

export let index!: Gianna.Index<IMarkerSearchDoc>;

const FIELDS = ["name", "labelNames", "sceneName"];

export interface IMarkerSearchDoc {
  _id: string;
  addedOn: number;
  name: string;
  labels: string[];
  labelNames: string[];
  rating: number;
  bookmark: number | null;
  favorite: boolean;
  scene: string;
  sceneName: string;
}

export async function createMarkerSearchDoc(marker: Marker): Promise<IMarkerSearchDoc> {
  const labels = await Marker.getLabels(marker);
  const scene = await Scene.getById(marker.scene);

  return {
    _id: marker._id,
    addedOn: marker.addedOn,
    name: marker.name,
    labels: labels.map((l) => l._id),
    labelNames: labels.map((l) => [l.name, ...l.aliases]).flat(),
    scene: scene ? scene._id : "",
    sceneName: scene ? scene.name : "",
    rating: marker.rating,
    bookmark: marker.bookmark,
    favorite: marker.favorite,
  };
}

async function addMarkerSearchDocs(docs: IMarkerSearchDoc[]): Promise<void> {
  logger.log(`Indexing ${docs.length} items...`);
  const timeNow = +new Date();
  const res = await index.index(docs);
  logger.log(`Gianna indexing done in ${(Date.now() - timeNow) / 1000}s`);
  return res;
}

export async function updateMarkers(markers: Marker[]): Promise<void> {
  return index.update(await mapAsync(markers, createMarkerSearchDoc));
}

export async function indexMarkers(markers: Marker[]): Promise<number> {
  let docs = [] as IMarkerSearchDoc[];
  let numItems = 0;
  for (const marker of markers) {
    docs.push(await createMarkerSearchDoc(marker));

    if (docs.length === (argv["index-slice-size"] || 5000)) {
      await addMarkerSearchDocs(docs);
      numItems += docs.length;
      docs = [];
    }
  }
  if (docs.length) {
    await addMarkerSearchDocs(docs);
    numItems += docs.length;
  }
  docs = [];
  return numItems;
}

export async function buildMarkerIndex(): Promise<Gianna.Index<IMarkerSearchDoc>> {
  index = await Gianna.createIndex("markers", FIELDS);

  const timeNow = +new Date();
  const loader = ora("Building marker index...").start();

  const res = await indexMarkers(await Marker.getAll());

  loader.succeed(`Build done in ${(Date.now() - timeNow) / 1000}s.`);
  logger.log(`Index size: ${res} items`);

  return index;
}

export async function searchMarkers(
  query: string,
  shuffleSeed = "default"
): Promise<Gianna.ISearchResults> {
  const options = extractQueryOptions(query);
  logger.log(`Searching markers for '${options.query}'...`);

  let sort = undefined as Gianna.ISortOptions | undefined;
  const filter = {
    type: "AND",
    children: [],
  } as Gianna.IFilterTreeGrouping;

  filterFavorites(filter, options);
  filterBookmark(filter, options);
  filterRating(filter, options);
  filterInclude(filter, options);
  filterExclude(filter, options);

  if (options.sortBy) {
    if (options.sortBy === "$shuffle") {
      sort = {
        sort_by: "$shuffle",
        sort_asc: false,
        sort_type: shuffleSeed,
      };
    } else {
      // eslint-disable-next-line
      const sortType = {
        addedOn: "number",
        name: "string",
        rating: "number",
        bookmark: "number",
      }[options.sortBy];
      sort = {
        // eslint-disable-next-line camelcase
        sort_by: options.sortBy,
        // eslint-disable-next-line camelcase
        sort_asc: options.sortDir === "asc",
        // eslint-disable-next-line
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
