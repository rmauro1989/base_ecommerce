import bcrypt from "bcryptjs";
import { z } from "zod";

export const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(100, "Máximo 100 caracteres");

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/** Hash ficticio para igualar tiempos cuando el usuario no existe. */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5lQd6tWCHMoUqtKXK8sB5VIa1hMxW6S";
export const verifyAgainstDummy = (password: string) => bcrypt.compare(password, DUMMY_HASH);
