import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

export const AGREEMENT_KEY_PREFIX = "agreements/";

function getConfig(): { client: S3Client; bucket: string } {
  const region = process.env.AWS_REGION;
  const bucket = process.env.S3_BUCKET_NAME;
  if (!region || !bucket) {
    throw new Error("AWS_REGION and S3_BUCKET_NAME must be set");
  }
  const client = new S3Client({ region, forcePathStyle: true });
  return { client, bucket };
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.AWS_REGION && process.env.S3_BUCKET_NAME);
}

export async function uploadAgreementPdf(
  agreementId: string,
  body: Buffer,
): Promise<{ objectKey: string }> {
  const { client, bucket } = getConfig();
  const objectKey = `${AGREEMENT_KEY_PREFIX}${agreementId}-${randomUUID()}.pdf`;
  const presignedUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: "application/pdf",
    }),
    { expiresIn: 300 },
  );
  const resp = await fetch(presignedUrl, {
    method: "PUT",
    body,
    headers: { "Content-Type": "application/pdf" },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Agreement PDF upload failed: ${resp.status} ${text}`);
  }
  return { objectKey };
}

export async function getAgreementDownloadUrl(objectKey: string): Promise<string> {
  const { client, bucket } = getConfig();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    { expiresIn: 600 },
  );
}
