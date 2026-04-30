import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

function getConfig(): { client: S3Client; bucket: string } {
  const region = process.env.AWS_REGION;
  const bucket = process.env.S3_BUCKET_NAME;
  if (!region || !bucket) {
    throw new Error("AWS_REGION and S3_BUCKET_NAME must be set");
  }
  const client = new S3Client({ region });
  return { client, bucket };
}

export const RESUME_KEY_PREFIX = "resumes/";
const UPLOAD_URL_TTL_SEC = 900;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidResumeKey(key: string): boolean {
  if (!key.startsWith(RESUME_KEY_PREFIX)) return false;
  const suffix = key.slice(RESUME_KEY_PREFIX.length);
  return UUID_RE.test(suffix);
}

export async function createResumeUploadUrl(contentType: string): Promise<{
  uploadUrl: string;
  objectKey: string;
}> {
  const { client, bucket } = getConfig();
  const objectKey = `${RESUME_KEY_PREFIX}${randomUUID()}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: UPLOAD_URL_TTL_SEC,
  });
  return { uploadUrl, objectKey };
}

export async function getResumeDownloadUrl(objectKey: string): Promise<string> {
  const { client, bucket } = getConfig();
  const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

