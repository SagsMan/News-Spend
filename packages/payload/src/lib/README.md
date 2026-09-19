# Payload Library Utilities

This directory contains utility functions and services for working with Payload CMS in the News Spend Media monorepo.

## getPayload.ts

A singleton utility for obtaining a configured Payload instance. This ensures that only one Payload instance is created and reused across your application, which is important for performance and avoiding connection pool exhaustion.

### Usage

```typescript
import { getPayload } from "@news-spend-media/payload/lib/getPayload";

export async function GET() {
  const payload = await getPayload();

  const news = await payload.find({
    collection: "news",
    limit: 10,
  });

  return Response.json(news);
}
```

### How It Works

1. **Singleton Pattern**: The `singleton` helper ensures that the Payload instance is created only once per application lifecycle
2. **Global Storage**: Uses `global.__singletons` to store instances across module reloads (useful in development with HMR)
3. **Automatic Configuration**: Automatically imports and applies the `configurePayload()` configuration
4. **Type Safe**: Returns a fully typed `Payload` instance

### Benefits

- **Performance**: Avoids creating multiple Payload instances
- **Memory Efficiency**: Reuses database connections and internal caches
- **Hot Module Replacement**: Works correctly with Next.js development mode
- **Type Safety**: Full TypeScript support

### Best Practices

1. **Always use `getPayload()`** instead of manually calling `getPayload({ config })` from the Payload package
2. **Call it in Server Components or API Routes only** - Payload is a server-side tool
3. **Don't store the result** - Call `getPayload()` each time you need it; the singleton handles caching

### Example: Server Component

```typescript
// app/news/page.tsx
import { getPayload } from "@news-spend-media/payload/lib/getPayload";

export default async function NewsPage() {
  const payload = await getPayload();

  const { docs: articles } = await payload.find({
    collection: "news",
    where: {
      _status: { equals: "published" },
    },
    sort: "-publishedAt",
    limit: 20,
  });

  return (
    <div>
      {articles.map((article) => (
        <article key={article.id}>
          <h2>{article.title}</h2>
          <p>{article.excerpt}</p>
        </article>
      ))}
    </div>
  );
}
```

### Example: API Route

```typescript
// app/api/news/[id]/route.ts
import { getPayload } from "@news-spend-media/payload/lib/getPayload";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getPayload();

  try {
    const article = await payload.findByID({
      collection: "news",
      id: params.id,
    });

    return NextResponse.json(article);
  } catch (error) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
}
```

### Example: Server Action

```typescript
// app/actions/news.ts
"use server";

import { getPayload } from "@news-spend-media/payload/lib/getPayload";
import { revalidatePath } from "next/cache";

export async function createNewsArticle(formData: FormData) {
  const payload = await getPayload();

  const article = await payload.create({
    collection: "news",
    data: {
      title: formData.get("title") as string,
      content: formData.get("content"),
      type: "article",
      _status: "draft",
    },
  });

  revalidatePath("/admin/news");

  return { success: true, id: article.id };
}
```

## Other Utilities

### expo-push-service.ts

Service for managing Expo push notifications, including:

- Batch sending of push notifications
- Push token management
- Receipt processing
- Dead token cleanup

### notification-actions.ts

Server actions for managing in-app notifications:

- Creating notifications
- Marking as read
- Retrieving user notifications

### utils.ts

Common utility functions:

- `cn()` - Tailwind CSS class name utility using `clsx` and `tailwind-merge`

---

For more information on Payload CMS, see the [official documentation](https://payloadcms.com/docs).
