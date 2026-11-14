import { Building2, FilePlus2, Home, Images, Mail } from "lucide-react";
import { ActionTile, Card, Grid } from "../ui";

export default function AdminTaskLinks({ zh, siteId, permissions }: { zh: boolean; siteId?: number; permissions: string[] }) {
  const tasks = [
    { permission: "site_users:write", href: siteId ? `/admin/sites/${siteId}/pages/homepage` : "/admin/homepage", icon: Home, zh: "更新首頁", en: "Update the homepage", detail: zh ? "文字、圖片與區塊排列" : "Copy, images and section order" },
    { permission: "cms:write", href: "/admin/cms/pages/new", icon: FilePlus2, zh: "新增文章", en: "Write an article", detail: zh ? "選顯示頁面、主題與卡片標籤" : "Choose placement, topics and card labels" },
    { permission: "stays:write", href: "/admin/stays", icon: Building2, zh: "修改住宿", en: "Edit a stay", detail: zh ? "住宿介紹、設施與照片" : "Descriptions, facilities and photos" },
    { permission: "media:write", href: "/admin/media", icon: Images, zh: "管理圖片", en: "Manage images", detail: zh ? "上傳與尋找共用素材" : "Upload and find shared media" },
    { permission: "newsletter:write", href: "/admin/newsletter", icon: Mail, zh: "製作電子報", en: "Prepare a newsletter", detail: zh ? "編輯內容、預覽與寄送" : "Compose, preview and send" }
  ].filter((task) => permissions.includes("*") || (permissions.includes(task.permission) && (task.permission !== "site_users:write" || permissions.includes("cms:read"))));
  if (!tasks.length) return null;
  return (
    <Card title={zh ? "今天要更新什麼？" : "What would you like to update?"}>
      <Grid cols={5}>
        {tasks.map(({ icon: Icon, ...task }) => (
          <ActionTile href={task.href} icon={<Icon />} key={task.href} text={task.detail} title={zh ? task.zh : task.en} />
        ))}
      </Grid>
    </Card>
  );
}
