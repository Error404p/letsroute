import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";

export const authPlugin = new Elysia()
    .use(
        jwt({
            name: "jwt",
            secret: process.env.JWT_SECRET || "your-super-secret-jwt-key-replace-in-production",
        })
    )
    .derive({ as: 'global' }, async ({ jwt, cookie: { auth } }) => {
        if (!auth?.value) {
            return { user: null };
        }
        const payload = await jwt.verify(auth.value);
        if (!payload) {
            return { user: null };
        }
        return {
            user: {
                id: payload.id as number,
                email: payload.email as string
            }
        };
    });

export const isAuthenticated = new Elysia()
    .use(authPlugin)
    .guard({
        beforeHandle({ user, set }) {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
        }
    });
