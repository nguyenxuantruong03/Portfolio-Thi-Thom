export type Project = {
  id: string;
  category?: "personal" | "professional";
  clientName?: string;
  projectRole?: string;
  projectPeriod?: string;
  externalUrl?: string;
  cardMediaLink?: string;
  label: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  overview: string;
  image: string;
  videoUrl?: string;
  tags?: string[];
  /** Quick-add cards (Professional Projects) have no detail page; they may link out instead. */
  noDetail?: boolean;
  link?: string;
};

export type PortfolioStat = {
  value: string;
  label: string;
  detail?: string;
};

export type PortfolioData = {
  name: string;
  headline: string;
  heroDescription: string;
  bio: string;
  phone: string;
  email: string;
  location: string;
  education: string;
  educationPeriod: string;
  educationMajor: string;
  focus: string;
  interests: string[];
  languages: string[];
  software: string[];
  stats: PortfolioStat[];
  experiences: { title: string; company: string; period: string; detail: string[] }[];
};

export const fallbackPortfolio: PortfolioData = {
  name: "Nguyễn Thị Thơm",
  headline: "Content Creator | TikTok & Short-form Video",
  heroDescription: "Mình yêu thích việc biến những ý tưởng đời thường thành nội dung gần gũi, dễ tiếp cận và có khả năng kết nối với người xem. Từ nghiên cứu insight, phát triển ý tưởng đến quay dựng và hoàn thiện video, mình luôn muốn tạo ra nội dung vừa có tính sáng tạo vừa mang lại giá trị thực tế.",
  bio: "Mình là Nguyễn Thị Thơm, yêu thích sáng tạo nội dung số, đặc biệt là TikTok và short-form video. Mình đã có trải nghiệm xây dựng nội dung cho bác sĩ nha khoa, biên tập video ngắn cho thương hiệu Photobooth và tự phát triển các kênh TikTok cá nhân từ A–Z. Qua mỗi dự án, mình có cơ hội rèn luyện khả năng nghiên cứu insight, tìm kiếm ý tưởng, tạo điểm thu hút ngay từ đầu, kể chuyện bằng hình ảnh và theo dõi hiệu quả nội dung. Mình mong muốn tiếp tục phát triển trong lĩnh vực Content Creation và Social Media, nơi mình có thể kết hợp tư duy sáng tạo với việc tạo ra những nội dung phù hợp với người xem.",
  phone: process.env.NEXT_PUBLIC_PHONE ?? "+84 335 805 359",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "thomn9416@gmail.com",
  location: process.env.NEXT_PUBLIC_LOCATION ?? "50 Nguyễn Kim, phường Diên Hồng, TP. Hồ Chí Minh",
  education: "HCMC University of Law",
  educationPeriod: "2022 — 2026",
  educationMajor: "Quản trị kinh doanh",
  focus: "TikTok · Sáng tạo nội dung · Dựng video",
  interests: ["Du lịch", "Ngoại ngữ"],
  languages: ["Tiếng Việt — Bản ngữ", "Tiếng Anh — Giao tiếp"],
  software: ["Photoshop", "Canva", "CapCut"],
  stats: [],
  experiences: [
    {
      title: "Nhân viên bán thời gian",
      company: "CGV Cinemas",
      period: "01/2023 — 11/2024",
      detail: [
        "Tư vấn sản phẩm, chương trình ưu đãi và hỗ trợ khách hàng trực tiếp, đảm bảo trải nghiệm dịch vụ tại rạp.",
        "Tư vấn sản phẩm đi kèm và chương trình khuyến mãi, góp phần tăng 10% doanh thu bán combo hàng tháng.",
        "Phối hợp với các bộ phận liên quan để xử lý tình huống phát sinh và đảm bảo vận hành dịch vụ."
      ]
    },
    {
      title: "EC Supervisor",
      company: "WESET English Center",
      period: "09/2024 — 07/2026",
      detail: [
        "Tư vấn chương trình đào tạo và lộ trình học dựa trên nhu cầu, mục tiêu và năng lực của học viên.",
        "Chủ động liên hệ, chăm sóc khách hàng từ nhiều nguồn dữ liệu và thúc đẩy chuyển đổi đăng ký.",
        "Cập nhật, quản lý thông tin khách hàng trên hệ thống; theo dõi lịch hẹn và kết quả tư vấn.",
        "Tiếp nhận phản hồi, phối hợp các bộ phận liên quan để xử lý vấn đề và đảm bảo chất lượng dịch vụ.",
        "Hỗ trợ quản lý đội ngũ EC, theo dõi tiến độ và hiệu quả tư vấn."
      ]
    },
    {
      title: "Content Marketing",
      company: "Bác sĩ Dr. Nguyễn",
      period: "07/2026 — 09/2026",
      detail: [
        "Phát triển nội dung TikTok theo định hướng xây dựng hình ảnh bác sĩ chuyên gia, truyền tải kiến thức nha khoa gần gũi, dễ hiểu.",
        "Nghiên cứu insight, xây dựng ý tưởng, viết phần mở đầu thu hút và kịch bản video ngắn.",
        "Thực hiện quay, dựng video, biên tập hình ảnh, âm thanh và quản lý nội dung kênh."
      ]
    }
  ],

};

export async function getPortfolioData(): Promise<PortfolioData> {
  const baseUrl = process.env.NEXT_PUBLIC_PORTFOLIO_API_URL;
  if (!baseUrl) return fallbackPortfolio;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/portfolio`, {
      next: { revalidate: 3600 },
      // Never let a slow external API hold up the page.
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return fallbackPortfolio;
    const remote = (await response.json()) as Partial<PortfolioData>;
    return {
      ...fallbackPortfolio,
      ...remote,
      stats: remote.stats?.length ? remote.stats : fallbackPortfolio.stats,
      experiences: remote.experiences ?? fallbackPortfolio.experiences,
    };
  } catch {
    return fallbackPortfolio;
  }
}
