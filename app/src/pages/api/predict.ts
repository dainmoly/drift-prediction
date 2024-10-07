import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
    ts: number;
    isWin: boolean;
    isFinished: boolean;
};

type ErrorData = {
    message: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData | ErrorData>
) {
    res.setHeader('Access-Control-Allow-Credentials', "true")
    res.setHeader('Access-Control-Allow-Origin', '*') // replace this your actual origin
    res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT');

    const ts = Math.floor(new Date().getTime() / 1000);
    const isWin = false;
    const isFinished = false;

    res.status(200).json({
        ts,
        isWin,
        isFinished,
    });
}
