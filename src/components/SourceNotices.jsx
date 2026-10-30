import { FileText, ExternalLink } from "lucide-react";

export default function SourceNotices({ sources }) {
  return sources
    .filter((source) => source.reuse_notice)
    .map((source) => {
      const notice = source.reuse_notice;
      return (
        <section
          className="source-reuse-notice"
          aria-label={notice.label}
          key={source.id}
        >
          <h2>
            <FileText size={16} />
            {notice.label}
          </h2>
          <p>{notice.notice}</p>
          <div className="source-notice-actions">
            <details>
              <summary>Full Project Gutenberg License</summary>
              <pre>{notice.full_license}</pre>
            </details>
            <a href={notice.original_url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              Original Gutenberg format
            </a>
            <a href={notice.license_url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              License at Gutenberg
            </a>
          </div>
        </section>
      );
    });
}
