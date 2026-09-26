export default ({ env }) => {
  const minioEndpoint = String(env("MINIO_ENDPOINT", "")).replace(/\/+$/, "");
  const accessKey = env("MINIO_ACCESS_KEY", "");
  const secretKey = env("MINIO_SECRET_KEY", "");
  const bucket = env("MINIO_BUCKET_PUBLIC", "terabis-public");
  const region = env("MINIO_REGION", "us-east-1");
  const useMinio = Boolean(minioEndpoint && accessKey && secretKey);
  const publicBase =
    env("MINIO_PUBLIC_BASE_URL", "") ||
    (useMinio ? `${minioEndpoint}/${bucket}` : "");

  return {
    seo: {
      enabled: true,
    },
    ...(useMinio
      ? {
          upload: {
            config: {
              provider: "aws-s3",
              providerOptions: {
                baseUrl: publicBase,
                rootPath: env("MINIO_CMS_ROOT", "cms"),
                s3Options: {
                  credentials: {
                    accessKeyId: accessKey,
                    secretAccessKey: secretKey,
                  },
                  endpoint: minioEndpoint,
                  region,
                  forcePathStyle: true,
                  params: {
                    Bucket: bucket,
                  },
                },
              },
              actionOptions: {
                upload: {},
                uploadStream: {},
                delete: {},
              },
            },
          },
        }
      : {}),
  };
};
