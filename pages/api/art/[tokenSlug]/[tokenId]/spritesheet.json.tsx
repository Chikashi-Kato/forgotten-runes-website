import { NextApiRequest, NextApiResponse } from "next";
import {
  buildSpritesheet,
  stripExtension,
  VALID_TOKEN_STYLES,
} from "../../../../../lib/art/artGeneration";
import initMiddleware from "../../../../../lib/initMiddleware";
import Cors from "cors";

const cors = initMiddleware(
  // You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
  Cors({
    // Only allow requests with GET, POST and OPTIONS
    methods: ["GET", "POST", "OPTIONS"],
  })
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await cors(req, res);

  if (req.method !== "GET") {
    return res.status(404);
  }
  console.log("req.query: ", req.query);

  let { tokenSlug, tokenId, width, style, trim } = req.query;

  let isJSON = false;
  if ((tokenId as string).match(/\.json$/)) {
    isJSON = true;
  }
  tokenId = stripExtension(tokenId as string);

  let trimOption = !trim || trim === "0" ? false : true;
  let widthOption = !width ? 50 : parseInt(width as string);

  const styleSlug = style ? stripExtension(style as string) : "default";
  if (!VALID_TOKEN_STYLES.includes(styleSlug)) {
    throw new Error(`${styleSlug} is not a valid style`);
  }

  let genOptions = {
    tokenSlug: tokenSlug as string,
    tokenId: tokenId as string,
    width: widthOption,
    image: false,
  };

  const { sheet }: any = await buildSpritesheet(genOptions);

  return res.status(200).json(sheet);

  // const buffer = await getStyledTokenBuffer(genOptions);
  // var bufferStream = new stream.PassThrough();
  // bufferStream.end(buffer);
  // return bufferStream.pipe(res);
}
