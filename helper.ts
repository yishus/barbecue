import { stat } from "node:fs/promises";

export const fileStatAtPath = async (path: string) => {
  try {
    const stats = await stat(path);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch (err) {
    console.log(err);
  }
};
