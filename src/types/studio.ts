import { generateHash } from "../hash";
import Label from "./label";
import Actor from "./actor";
import Scene from "./scene";
import Movie from "./movie";
import { mapAsync } from "./utility";
import * as logger from "../logger";
import { studioCollection } from "../database";
import LRU from "lru-cache";

export const studioCache = new LRU({
  max: 500,
  maxAge: 3600 * 1000,
});

export default class Studio {
  _id: string;
  name: string;
  description: string | null = null;
  thumbnail: string | null = null;
  addedOn: number = +new Date();
  favorite: boolean = false;
  bookmark: number | null = null;
  parent: string | null = null;
  labels?: string[]; // backwards compatibility
  aliases?: string[];

  static async checkIntegrity() {}

  constructor(name: string) {
    this._id = "st_" + generateHash();
    this.name = name;
  }

  static async remove(studioId: string) {
    await studioCollection.remove(studioId);
  }

  static async filterStudio(studioId: string) {
    for (const studio of await Studio.getAll()) {
      if (studio.parent == studioId) {
        studio.parent = null;
        await studioCollection.upsert(studio._id, studio);
      }
    }
  }

  static async getById(_id: string, useCache = false) {
    if (useCache) {
      const item = studioCache.get(_id);
      if (item) return item as Studio;
    }
    const studio = await studioCollection.get(_id);
    if (useCache) {
      studioCache.set(_id, studio);
    }
    return studio;
  }

  static async getAll() {
    return studioCollection.getAll();
  }

  static async getScenes(studio: Studio): Promise<Scene[]> {
    const scenes = await Scene.getByStudio(studio._id);
    const subStudios = await Studio.getSubStudios(studio._id);

    const scenesOfSubStudios = (
      await Promise.all(subStudios.map((child) => Studio.getScenes(child)))
    ).flat();

    return scenes.concat(scenesOfSubStudios);
  }

  static async getMovies(studio: Studio): Promise<Movie[]> {
    const movies = await Movie.getByStudio(studio._id);

    const moviesOfSubStudios = (
      await Promise.all(
        (await Studio.getSubStudios(studio._id)).map((child) =>
          Studio.getMovies(child)
        )
      )
    ).flat();

    return movies.concat(moviesOfSubStudios);
  }

  static async getSubStudios(studioId: string) {
    return studioCollection.query("parent-index", studioId);
  }

  static async getActors(studio: Studio) {
    const scenes = await Studio.getScenes(studio);
    const actorIds = [
      ...new Set(
        (await mapAsync(scenes, Scene.getActors)).flat().map((a) => a._id)
      ),
    ];
    return (
      await mapAsync(actorIds, (id) => {
        return Actor.getById(id);
      })
    ).filter(Boolean) as Actor[];
  }

  static async setLabels(studio: Studio, labelIds: string[]) {
    return Label.setForItem(studio._id, labelIds, "studio");
  }

  static async getLabels(studio: Studio) {
    return Label.getForItem(studio._id);
  }

  static async inferLabels(studio: Studio) {
    const scenes = await Studio.getScenes(studio);
    const labelIds = [...new Set(scenes.map((scene) => scene.labels).flat())];
    return (await mapAsync(labelIds, Label.getById)).filter(Boolean) as Label[];
  }
}
