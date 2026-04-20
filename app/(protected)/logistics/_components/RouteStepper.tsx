'use client';

import React from 'react';

export interface RouteNode {
  icon: React.ReactNode;
  label: string;
  mapHref?: string;
}

export interface RouteLeg {
  km: number;
  href?: string;
}

export default function RouteStepper({ nodes, legs }: { nodes: RouteNode[]; legs: RouteLeg[] }) {
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {nodes.map((node, i) => (
        <React.Fragment key={i}>
          <span className="inline-flex items-center gap-0.5 text-xs text-stone-400">
            {node.icon}
            {node.mapHref ? (
              <a
                href={node.mapHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="leading-none hover:text-primary hover:underline transition-colors"
              >
                {node.label}
              </a>
            ) : (
              <span className="leading-none">{node.label}</span>
            )}
          </span>
          {i < legs.length && (
            <span className="inline-flex items-center gap-0.5">
              <span className="text-stone-300 mx-0.5 leading-none">›</span>
              {legs[i].href ? (
                <a
                  href={legs[i].href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors leading-none"
                >
                  {legs[i].km % 1 === 0 ? `${legs[i].km} กม.` : `${legs[i].km.toFixed(1)} กม.`}
                </a>
              ) : (
                <span className="inline-flex items-center rounded-full bg-stone-100 px-1.5 py-0.5 text-xs font-bold text-stone-500 leading-none">
                  {legs[i].km % 1 === 0 ? `${legs[i].km} กม.` : `${legs[i].km.toFixed(1)} กม.`}
                </span>
              )}
              <span className="text-stone-300 mx-0.5 leading-none">›</span>
            </span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
}
