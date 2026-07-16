import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || process.env.S3_REGION;

const s3Client = new S3Client({
    region: awsRegion,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim()
    }
});

export { awsRegion, s3Client };
