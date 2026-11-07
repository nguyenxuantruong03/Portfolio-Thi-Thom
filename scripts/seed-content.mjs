import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
import fs from "node:fs/promises";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const client = new Client({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } });
const seed = JSON.parse(await fs.readFile(new URL("../db/seed-content.json", import.meta.url), "utf8"));
const doc = (text) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

await client.connect();
try {
  await client.query("BEGIN");
  for (const [index, item] of seed.featured.entries()) {
    await client.query(
      `INSERT INTO portfolio_featured (id,label,topic,title,excerpt,content,content_html,media,sort_order,published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
       ON CONFLICT (id) DO UPDATE SET label=excluded.label,topic=excluded.topic,title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,content_html=excluded.content_html,media=excluded.media,sort_order=excluded.sort_order,updated_at=now()`,
      [item.id,item.label??"Featured",item.topic,item.title,item.title,JSON.stringify(doc(item.title)),`<h2>${item.title}</h2><p>${item.topic}</p>`,JSON.stringify([
        ...(item.posterUrl ? [{ id:`${item.id}-poster`,url:item.posterUrl,publicId:"",resourceType:"image",alt:item.title }] : []),
        ...(item.videoUrl ? [{ id:`${item.id}-video`,url:item.videoUrl,publicId:"",resourceType:"video" }] : [])
      ]),index]
    );
  }
  for (const [index, item] of seed.projects.entries()) {
    const html = [
      `<h2>Tổng quan</h2><p>${item.overview}</p>`,
      `<h2>Vai trò</h2><ul>${item.role.map(x=>`<li>${x}</li>`).join("")}</ul>`,
      `<h2>Phong cách</h2><p>${item.style}</p>`,
      `<h2>Quy trình</h2><ol>${item.workflow.map(x=>`<li>${x}</li>`).join("")}</ol>`,
      item.result ? `<h2>Kết quả</h2><p>${item.result}</p>` : ""
    ].join("");
    const media = [
      ...(item.image ? [{ id:`${item.id}-image`,url:item.image,publicId:"",resourceType:"image",alt:item.title }] : []),
      ...(item.videoUrl ? [{ id:`${item.id}-video`,url:item.videoUrl,publicId:"",resourceType:"video" }] : [])
    ];
    await client.query(
      `INSERT INTO portfolio_projects (id,slug,label,eyebrow,title,subtitle,excerpt,content,content_html,media,tags,sort_order,published,category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13)
       ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,label=excluded.label,eyebrow=excluded.eyebrow,title=excluded.title,subtitle=excluded.subtitle,excerpt=excluded.excerpt,content=excluded.content,content_html=excluded.content_html,media=excluded.media,tags=excluded.tags,sort_order=excluded.sort_order,category=excluded.category,updated_at=now()`,
      [item.id,item.id,item.label??"Project",item.eyebrow,item.title,item.subtitle,item.overview,JSON.stringify(doc(item.overview)),html,JSON.stringify(media),item.tags??[],index,item.category ?? "personal"]
    );
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
console.log("Portfolio content seeded.");
