import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownAnswerProps = {
  content: string;
  className?: string;
};

export default function MarkdownAnswer({ content, className }: MarkdownAnswerProps) {
  return (
    <div className={className}>
      <div className="markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
