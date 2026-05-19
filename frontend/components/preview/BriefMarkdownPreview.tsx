'use client';

import ReactMarkdown from 'react-markdown';

interface Props {
  preview: string;
  isTruncated: boolean;
}

export function BriefMarkdownPreview({ preview, isTruncated }: Props) {
  return (
    <ReactMarkdown
      components={{
        h2: ({ children }) => (
          <h2 className="text-base font-semibold text-white mt-5 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-slate-200 mt-4 mb-1">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-slate-300 leading-relaxed mb-3">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="text-slate-100 font-semibold">{children}</strong>
        ),
        ul: ({ children }) => <ul className="mb-3 space-y-1">{children}</ul>,
        li: ({ children }) => (
          // eslint-disable-next-line jsx-a11y/no-list-item-without-parent
          <li className="text-sm text-slate-300 flex items-start gap-2">
            <span className="text-blue-400 mt-1 shrink-0">›</span>
            <span>{children}</span>
          </li>
        ),
        hr: () => <hr className="border-white/10 my-4" />,
      }}
    >
      {isTruncated ? preview : preview}
    </ReactMarkdown>
  );
}
