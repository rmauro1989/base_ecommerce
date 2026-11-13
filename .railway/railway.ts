/**
 * Infraestructura de la tienda en Railway (Infrastructure as Code).
 *
 *   railway config plan    → muestra los cambios sin aplicarlos
 *   railway config apply   → los aplica al proyecto vinculado
 *
 * Declara el servicio web, PostgreSQL y el volumen de imágenes.
 * Las variables de entorno NO se gestionan aquí (cambian por tienda y
 * contienen secretos): se definen en Railway (ver README y .env.example).
 */
import { defineRailway, github, postgres, project, service, volume } from "railway/iac";

// Este repositorio gestiona solo sus propios recursos del proyecto.
export const partial = "base_ecommerce";

const REGION = "us-west2";

export default defineRailway(() => {
  const db = postgres("Postgres");

  // Imágenes subidas cuando no se configura S3 (la app usa RAILWAY_VOLUME_MOUNT_PATH/uploads)
  const uploads = volume("base_ecommerce-uploads", { region: REGION, sizeMB: 5000 });

  const web = service("base_ecommerce", {
    source: github("rmauro1989/base_ecommerce", { branch: "main", checkSuites: false }),
    build: { buildCommand: "npm run build", buildEnvironment: "V3", builder: "RAILPACK" },
    // Valida variables, aplica migraciones, carga el seed si la base está vacía e inicia Next
    start: "npm run start",
    healthcheck: "/api/health",
    healthcheckTimeout: 180,
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 5 },
    replicas: { [REGION]: 1 },
    networking: { privateNetworkEndpoint: "baseecommerce" },
    volumeMounts: { "/data": uploads },
  });

  return project("handsome-gratitude", {
    variables: { managed: false },
    resources: [db, uploads, web],
  });
});
