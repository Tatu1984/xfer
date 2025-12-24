import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const articleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

// GET - Search/list articles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const slug = searchParams.get("slug");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get single article by slug
    if (slug) {
      const article = await prisma.knowledgeArticle.findUnique({
        where: { slug },
      });

      if (!article || article.status !== "PUBLISHED") {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      // Increment view count
      await prisma.knowledgeArticle.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      });

      return NextResponse.json({ article });
    }

    // Build where clause
    const where: Record<string, unknown> = { status: "PUBLISHED" };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
        { tags: { hasSome: [search.toLowerCase()] } },
      ];
    }

    const [articles, total, categories] = await Promise.all([
      prisma.knowledgeArticle.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          category: true,
          tags: true,
          viewCount: true,
          helpfulCount: true,
          publishedAt: true,
        },
        orderBy: search ? { viewCount: "desc" } : { publishedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.knowledgeArticle.count({ where }),
      prisma.knowledgeArticle.groupBy({
        by: ["category"],
        where: { status: "PUBLISHED" },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      articles,
      categories: categories.map((c) => ({ name: c.category, count: c._count })),
      pagination: { total, limit, offset, hasMore: offset + articles.length < total },
    });
  } catch (error) {
    console.error("Get knowledge articles error:", error);
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
  }
}

// POST - Create article (admin only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const data = articleSchema.parse(body);

    // Generate unique slug
    let slug = generateSlug(data.title);
    let suffix = 0;

    while (await prisma.knowledgeArticle.findUnique({ where: { slug } })) {
      suffix++;
      slug = `${generateSlug(data.title)}-${suffix}`;
    }

    const article = await prisma.knowledgeArticle.create({
      data: {
        slug,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || data.content.slice(0, 200) + "...",
        category: data.category,
        tags: data.tags || [],
        status: data.status || "DRAFT",
        authorId: authResult.id,
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
      },
    });

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create knowledge article error:", error);
    return NextResponse.json({ error: "Failed to create article" }, { status: 500 });
  }
}

// PATCH - Update article or record feedback
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, slug, helpful } = body;

    // Handle feedback
    if ((id || slug) && helpful !== undefined) {
      const where = id ? { id } : { slug };
      const article = await prisma.knowledgeArticle.findFirst({ where });

      if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      const updateData = helpful
        ? { helpfulCount: { increment: 1 } }
        : { notHelpfulCount: { increment: 1 } };

      await prisma.knowledgeArticle.update({
        where: { id: article.id },
        data: updateData,
      });

      return NextResponse.json({ success: true });
    }

    // Update article (admin only)
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    if (!id) {
      return NextResponse.json({ error: "Article ID required" }, { status: 400 });
    }

    const article = await prisma.knowledgeArticle.findUnique({
      where: { id },
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const { title, content, excerpt, category, tags, status } = body;

    const updateData: Record<string, unknown> = {};
    if (title) {
      updateData.title = title;
      // Update slug if title changed significantly
      if (title.toLowerCase() !== article.title.toLowerCase()) {
        let newSlug = generateSlug(title);
        let suffix = 0;
        while (await prisma.knowledgeArticle.findFirst({
          where: { slug: newSlug, id: { not: id } },
        })) {
          suffix++;
          newSlug = `${generateSlug(title)}-${suffix}`;
        }
        updateData.slug = newSlug;
      }
    }
    if (content) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (category) updateData.category = category;
    if (tags) updateData.tags = tags;
    if (status) {
      updateData.status = status;
      if (status === "PUBLISHED" && !article.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const updated = await prisma.knowledgeArticle.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ article: updated });
  } catch (error) {
    console.error("Update knowledge article error:", error);
    return NextResponse.json({ error: "Failed to update article" }, { status: 500 });
  }
}

// DELETE - Delete article (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Article ID required" }, { status: 400 });
    }

    await prisma.knowledgeArticle.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete knowledge article error:", error);
    return NextResponse.json({ error: "Failed to delete article" }, { status: 500 });
  }
}
