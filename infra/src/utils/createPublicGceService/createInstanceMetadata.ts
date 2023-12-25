import * as gcp from '@pulumi/gcp';
import * as yaml from 'yaml';
import { Env, Image } from '.';

type CreateInstanceMetadataParams = {
  resourcePrefix: string;
  image: Image;
  secret: gcp.secretmanager.Secret;
  env: Env[];
};

export const createInstanceMetadata = (
  params: CreateInstanceMetadataParams,
) => {
  return {
    'gce-container-declaration': yaml.stringify({
      spec: {
        containers: [
          {
            name: params.resourcePrefix,
            image: params.image.url,
            stdin: false,
            tty: false,
            env: params.env,
            volumeMounts: [
              {
                name: 'env',
                mountPath: '/app/.env',
                readOnly: true,
              },
            ],
          },
        ],
        volumes: [
          {
            name: 'env',
            hostPath: {
              path: '/tmp/.env',
            },
          },
        ],
        restartPolicy: 'Always',
      },
    }),
    'google-logging-enabled': 'true',
    'startup-script': `
      #!/bin/bash
      ACCESS_TOKEN=$(curl http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token --header "Metadata-Flavor: Google" | jq -r '.access_token')

      curl "https://secretmanager.googleapis.com/v1/projects/${params.secret.project}/secrets/${params.secret.name}/versions/latest:access" \
        --request "GET" \
        --header "Authorization: Bearer $ACCESS_TOKEN" \
        --header "content-type: application/json" \
        | jq -r ".payload.data" | base64 --decode \
        >> /tmp/.env
    `,
  };
};