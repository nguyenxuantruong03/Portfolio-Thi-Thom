"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "vi" | "en";
const STORAGE_KEY = "portfolio-lang";

type Dict = Record<string, string>;

const vi: Dict = {
  "nav.home": "Giới thiệu",
  "nav.metrics": "Tổng số liệu",
  "nav.about": "Về tôi",
  "nav.experience": "Kinh nghiệm",
  "nav.personal": "Dự án cá nhân",
  "nav.professional": "Dự án chuyên nghiệp",
  "nav.design2d": "Thiết kế 2D",
  "nav.contact": "Liên hệ",
  "nav.menu": "Mở menu",
  "nav.language": "Ngôn ngữ",

  "hero.title": "XIN CHÀO, MÌNH LÀ THƠM!",
  "hero.subtitle": "MÌNH TẠO NỘI DUNG CÓ SỨC KẾT NỐI.",
  "hero.headline": "Content Creator | TikTok & Short-form Video",
  "hero.description":
    "Mình yêu thích việc biến những ý tưởng đời thường thành nội dung gần gũi, dễ tiếp cận và có khả năng kết nối với người xem. Từ nghiên cứu insight, phát triển ý tưởng đến quay dựng và hoàn thiện video, mình luôn muốn tạo ra nội dung vừa có tính sáng tạo vừa mang lại giá trị thực tế.",
  "hero.cta.work": "Xem sản phẩm",
  "hero.cta.contact": "Liên hệ mình",
  "hero.photoAlt": "Ảnh đại diện Nguyễn Thị Thơm",

  "about.eyebrow": "03 · Về tôi",
  "about.title": "VỀ MÌNH",
  "about.p1": "Mình là <strong>Nguyễn Thị Thơm</strong>, yêu thích sáng tạo nội dung số, đặc biệt là TikTok và short-form video.",
  "about.p2": "Mình từng xây dựng nội dung cho bác sĩ nha khoa, biên tập video ngắn cho thương hiệu Photobooth và phát triển các kênh TikTok cá nhân từ A–Z.",
  "about.p3": "Thế mạnh của mình là nghiên cứu insight, tìm ý tưởng, tạo điểm thu hút ngay từ đầu, kể chuyện bằng hình ảnh và theo dõi hiệu quả nội dung. Mình muốn tiếp tục phát triển trong Content Creation và Social Media.",
  "about.education": "Học vấn",
  "about.major": "Chuyên ngành",
  "about.period": "Thời gian",
  "about.location": "Địa điểm",
  "about.locationValue": "TP. Hồ Chí Minh, Việt Nam",
  "about.certificates": "Chứng chỉ",
  "about.majorValue": "Quản trị kinh doanh",
  "about.cert.toeic": "TOEIC 710 (Reading & Listening)",
  "about.cert.photoshop": "Photoshop — Color Me",
  "about.cert.slide": "Perfect Slide — GoEdu",

  "exp.eyebrow": "04 · Kinh nghiệm",
  "exp.title": "Kinh nghiệm",


  "personal.eyebrow": "05 · Dự án cá nhân",
  "personal.title": "Dự án cá nhân",
  "personal.desc": "Các dự án do Thị Thơm tự phát triển, xây dựng nội dung và thực hiện.",

  "professional.eyebrow": "06 · Dự án chuyên nghiệp",
  "professional.title": "Dự án chuyên nghiệp",
  "professional.desc": "Các dự án thực hiện cho khách hàng, thương hiệu và đối tác.",

  "design2d.eyebrow": "07 · Thiết kế đồ họa",
  "design2d.title": "2D Graphic Design",
  "design2d.desc": "Tuyển chọn các dự án thiết kế đồ họa cho ấn phẩm số và in ấn. Bấm vào từng dự án để xem toàn bộ hình ảnh.",
  "design2d.empty": "Hình ảnh thiết kế sẽ sớm được cập nhật.",
  "design2d.noImage": "Chưa có hình ảnh",
  "design2d.all": "Tất cả",
  "design2d.filter": "Lọc theo loại thiết kế",
  "design2d.more": "Xem thêm",
  "design2d.less": "Thu gọn",
  "design2d.project": "Dự án",
  "design2d.image": "Ảnh",
  "design2d.categories": "Loại thiết kế",
  "design2d.uncategorized": "Chưa phân loại",
  "design2d.size": "Kích thước",
  "design2d.format": "Định dạng",
  "design2d.thumbs": "Ảnh trong dự án",
  "design2d.prevProject": "Dự án trước",
  "design2d.nextProject": "Dự án sau",
  "design2d.close": "Đóng",
  "design2d.prev": "Ảnh trước",
  "design2d.next": "Ảnh sau",

  "projects.empty": "Dự án sẽ sớm được cập nhật.",
  "projects.view": "Xem",
  "projects.selected": "Dự án tiêu biểu",
  "projects.preview": "Xem trước dự án",
  "projects.default": "Dự án",
  "projects.prev": "Dự án trước",
  "projects.next": "Dự án tiếp theo",

  "contact.eyebrow": "07 · Liên hệ",
  "contact.title": "CÙNG TẠO RA ĐIỀU Ý NGHĨA.",
  "contact.desc": "Mình luôn sẵn sàng kết nối và trao đổi về các cơ hội hợp tác trong lĩnh vực sáng tạo nội dung, video và truyền thông.",
  "form.name": "Họ và tên",
  "form.email": "Email",
  "form.message": "Bạn muốn trao đổi điều gì?",
  "form.send": "Gửi lời nhắn",
  "form.sending": "Đang gửi…",
  "form.errName": "Vui lòng nhập họ tên.",
  "form.errEmail": "Email chưa đúng định dạng.",
  "form.errMessage": "Tin nhắn cần ít nhất 10 ký tự.",
  "form.fail": "Không thể gửi tin nhắn.",
  "form.ok": "Đã gửi thành công. Cảm ơn bạn đã liên hệ!",

  "footer.rights": "Bảo lưu mọi quyền.",
  "footer.tagline": "Sáng tạo nội dung · Social Media · Video",

  "metrics.followers": "Tổng Followers",
  "metrics.likes": "Tổng lượt thích",
  "metrics.topFollowers": "Follower cao nhất",
  "metrics.topLikes": "Lượt thích cao nhất",
  "metrics.projects": "Dự án",
  "metrics.accounts": "4 tài khoản TikTok",
  "metrics.published": "Dự án đã đăng",
  "metrics.refresh": "Làm mới",
  "metrics.updating": "Đang cập nhật",
  "metrics.updated": "Cập nhật",
  "metrics.tiktokData": "Dữ liệu TikTok",
  "metrics.snapshot": "Dùng số liệu tạm thời khi TikTok chưa cung cấp dữ liệu",

};

const en: Dict = {
  "nav.home": "Introduction",
  "nav.metrics": "Statistics",
  "nav.about": "About Me",
  "nav.experience": "Experience",
  "nav.personal": "Personal Projects",
  "nav.professional": "Professional Projects",
  "nav.design2d": "2D Design",
  "nav.contact": "Contact",
  "nav.menu": "Open menu",
  "nav.language": "Language",

  "hero.title": "HELLO, I'M THƠM!",
  "hero.subtitle": "I CREATE CONTENT THAT CONNECTS.",
  "hero.headline": "Content Creator | TikTok & Short-form Video",
  "hero.description":
    "I love turning everyday ideas into relatable, accessible content that connects with viewers. From insight research and idea development to filming, editing and finishing videos, I always aim to create content that is both creative and genuinely valuable.",
  "hero.cta.work": "View My Work",
  "hero.cta.contact": "Get in Touch",
  "hero.photoAlt": "Portrait of Nguyễn Thị Thơm",

  "about.eyebrow": "03 · About Me",
  "about.title": "ABOUT ME",
  "about.p1": "I'm <strong>Nguyễn Thị Thơm</strong>, passionate about digital content creation, especially TikTok and short-form video.",
  "about.p2": "I have created content for a dental doctor, edited short videos for a Photobooth brand, and grown personal TikTok channels from scratch.",
  "about.p3": "My strengths are insight research, idea generation, hooking viewers from the first second, visual storytelling and tracking content performance. I want to keep growing in Content Creation and Social Media.",
  "about.education": "Education",
  "about.major": "Major",
  "about.period": "Period",
  "about.location": "Location",
  "about.locationValue": "Ho Chi Minh City, Vietnam",
  "about.certificates": "Certificates",
  "about.majorValue": "Business Administration",
  "about.cert.toeic": "TOEIC 710 (Reading & Listening)",
  "about.cert.photoshop": "Photoshop — Color Me",
  "about.cert.slide": "Perfect Slide — GoEdu",

  "exp.eyebrow": "04 · Experience",
  "exp.title": "Experience",


  "personal.eyebrow": "05 · Personal Projects",
  "personal.title": "Personal Projects",
  "personal.desc": "Projects independently developed, produced, and managed by Thị Thơm.",

  "professional.eyebrow": "06 · Professional Projects",
  "professional.title": "Professional Projects",
  "professional.desc": "Projects delivered for clients, brands, and professional partners.",

  "design2d.eyebrow": "07 · Graphic Design",
  "design2d.title": "2D Graphic Design",
  "design2d.desc": "A collection of creative visual designs for digital and print media. Click a project to view all of its images.",
  "design2d.empty": "Design images will be added soon.",
  "design2d.noImage": "No images yet",
  "design2d.all": "All",
  "design2d.filter": "Filter by design type",
  "design2d.more": "Show more",
  "design2d.less": "Show less",
  "design2d.project": "Project",
  "design2d.image": "Image",
  "design2d.categories": "Design type",
  "design2d.uncategorized": "Uncategorized",
  "design2d.size": "Size",
  "design2d.format": "Format",
  "design2d.thumbs": "Images in this project",
  "design2d.prevProject": "Previous project",
  "design2d.nextProject": "Next project",
  "design2d.close": "Close",
  "design2d.prev": "Previous image",
  "design2d.next": "Next image",

  "projects.empty": "Projects will be added soon.",
  "projects.view": "View",
  "projects.selected": "Selected work",
  "projects.preview": "Project preview",
  "projects.default": "Project",
  "projects.prev": "Previous projects",
  "projects.next": "Next projects",

  "contact.eyebrow": "07 · Contact",
  "contact.title": "LET'S CREATE SOMETHING MEANINGFUL.",
  "contact.desc": "I'm always open to connecting and discussing collaboration in content creation, video and communications.",
  "form.name": "Full name",
  "form.email": "Email",
  "form.message": "What would you like to talk about?",
  "form.send": "Send message",
  "form.sending": "Sending…",
  "form.errName": "Please enter your name.",
  "form.errEmail": "Email format is invalid.",
  "form.errMessage": "Message must be at least 10 characters.",
  "form.fail": "Could not send your message.",
  "form.ok": "Sent successfully. Thank you for reaching out!",

  "footer.rights": "All rights reserved.",
  "footer.tagline": "Content Creation · Social Media · Video",

  "metrics.followers": "Total Followers",
  "metrics.likes": "Total Likes",
  "metrics.topFollowers": "Top Followers",
  "metrics.topLikes": "Top Likes",
  "metrics.projects": "Projects",
  "metrics.accounts": "4 TikTok accounts",
  "metrics.published": "Published projects",
  "metrics.refresh": "Refresh",
  "metrics.updating": "Updating",
  "metrics.updated": "Updated",
  "metrics.tiktokData": "TikTok data",
  "metrics.snapshot": "Portfolio snapshot used where TikTok has not supplied data yet",

};

const dictionaries: Record<Lang, Dict> = { vi, en };

/** English versions of the built-in experience entries, keyed by company. */
export const experienceEn: Record<string, { title: string; detail: string[] }> = {
  "CGV Cinemas": {
    title: "Part-time Staff",
    detail: [
      "Advised customers on products and promotions and provided on-site support to ensure a great cinema experience.",
      "Recommended add-on products and promotions, contributing to a 10% monthly increase in combo sales revenue.",
      "Coordinated with other departments to handle incidents and keep service operations running smoothly.",
    ],
  },
  "WESET English Center": {
    title: "EC Supervisor",
    detail: [
      "Advised on training programs and learning paths based on each student's needs, goals and ability.",
      "Proactively contacted and nurtured leads from multiple data sources to drive enrollment conversions.",
      "Updated and managed customer information in the system; tracked appointments and consultation results.",
      "Collected feedback and coordinated with departments to resolve issues and protect service quality.",
      "Supported the EC team's management, tracking progress and consultation performance.",
    ],
  },
  "Bác sĩ Dr. Nguyễn": {
    title: "Content Marketing",
    detail: [
      "Developed TikTok content to build an expert-doctor image, delivering dental knowledge in a friendly, easy-to-understand way.",
      "Researched insights, developed ideas, wrote attention-grabbing hooks and short-video scripts.",
      "Filmed and edited videos, handled visuals and audio, and managed the channel's content.",
    ],
  },
};

type Ctx = { lang: Lang; setLang: (lang: Lang) => void; t: (key: string) => string };
const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("vi");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // Vietnamese is the default language for first-time visitors.
      // Only restore English when the visitor explicitly selected it before.
      if (saved === "vi" || saved === "en") setLangState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ lang, setLang, t: (key) => dictionaries[lang][key] ?? dictionaries.vi[key] ?? key }),
    [lang, setLang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
