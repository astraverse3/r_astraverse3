/* global React */
// Tiny lucide-style icon components — pure SVG, no external deps.
// Each accepts {className, strokeWidth} like lucide-react.

const Icon = ({ children, className = '', strokeWidth = 2, ...rest }) =>
  React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: 24, height: 24, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor',
      strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
      className, ...rest,
    },
    children
  );

const p = (d, key) => React.createElement('path', { d, key });
const c = (cx, cy, r, key) => React.createElement('circle', { cx, cy, r, key });
const l = (x1, y1, x2, y2, key) => React.createElement('line', { x1, y1, x2, y2, key });
const r = (x, y, w, h, rx, key) => React.createElement('rect', { x, y, width: w, height: h, rx, key });
const poly = (pts, key) => React.createElement('polyline', { points: pts, key });

const make = (...kids) => (props) => React.createElement(Icon, props, kids);

window.lucide = {
  Home:        make(p('m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 1), poly('9 22 9 12 15 12 15 22', 2)),
  Package:     make(p('m7.5 4.27 9 5.15', 1), p('M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z', 2), poly('3.29 7 12 12 20.71 7', 3), l(12, 22, 12, 12, 4)),
  ClipboardList: make(r(8, 2, 8, 4, 1, 1), p('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 2), p('M12 11h4', 3), p('M12 16h4', 4), p('M8 11h.01', 5), p('M8 16h.01', 6)),
  Boxes:       make(p('M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z', 1), p('m7 16.5-4.74-2.85', 2), p('m7 16.5 5-3', 3), p('M7 16.5v5.17', 4), p('M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z', 5), p('m17 16.5-5-3', 6), p('m17 16.5 4.74-2.85', 7), p('M17 16.5v5.17', 8), p('M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0z', 9), p('M12 8 7.26 5.15', 10), p('m12 8 4.74-2.85', 11), p('M12 13.5V8', 12)),
  ShoppingCart: make(c(8, 21, 1, 1), c(19, 21, 1, 2), p('M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12', 3)),
  BarChart3:   make(p('M3 3v18h18', 1), p('M18 17V9', 2), p('M13 17V5', 3), p('M8 17v-3', 4)),
  Server:      make(r(2, 2, 20, 8, 2, 1), r(2, 14, 20, 8, 2, 2), l(6, 6, 6.01, 6, 3), l(6, 18, 6.01, 18, 4)),
  Leaf:        make(p('M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96c1.4 3.6.4 7.66-1.7 11.04-2 3.2-5 5-9.5 5z', 1), p('M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12', 2)),
  Users:       make(p('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 1), c(9, 7, 4, 2), p('M22 21v-2a4 4 0 0 0-3-3.87', 3), p('M16 3.13a4 4 0 0 1 0 7.75', 4)),
  ChevronDown: make(p('m6 9 6 6 6-6', 1)),
  ChevronRight: make(p('m9 18 6-6-6-6', 1)),
  ChevronUp:   make(p('m18 15-6-6-6 6', 1)),
  Sprout:      make(p('M7 20h10', 1), p('M10 20c5.5-2.5.8-6.4 3-10', 2), p('M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z', 3), p('M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z', 4)),
  Settings:    make(p('M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z', 1), c(12, 12, 3, 2)),
  History:     make(p('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 1), p('M3 3v5h5', 2), p('M12 7v5l4 2', 3)),
  Megaphone:   make(p('m3 11 18-5v12L3 14v-3z', 1), p('M11.6 16.8a3 3 0 1 1-5.8-1.6', 2)),
  Database:    make(React.createElement('ellipse', { cx: 12, cy: 5, rx: 9, ry: 3, key: 1 }), p('M3 5v14a9 3 0 0 0 18 0V5', 2), p('M3 12a9 3 0 0 0 18 0', 3)),
  Box:         make(p('M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 1), poly('3.27 6.96 12 12.01 20.73 6.96', 2), l(12, 22.08, 12, 12, 3)),
  Clipboard:   make(r(8, 2, 8, 4, 1, 1), p('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 2)),
  Activity:    make(poly('22 12 18 12 15 21 9 3 6 12 2 12', 1)),
  BarChart2:   make(l(18, 20, 18, 10, 1), l(12, 20, 12, 4, 2), l(6, 20, 6, 14, 3)),
  Layers:      make(p('m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z', 1), p('m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65', 2), p('m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65', 3)),
  TrendingUp:  make(poly('22 7 13.5 15.5 8.5 10.5 2 17', 1), poly('16 7 22 7 22 13', 2)),
  Compass:     make(c(12, 12, 10, 1), p('m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z', 2)),
  ArrowRightLeft: make(p('M8 3 4 7l4 4', 1), p('M4 7h16', 2), p('m16 21 4-4-4-4', 3), p('M20 17H4', 4)),
};
