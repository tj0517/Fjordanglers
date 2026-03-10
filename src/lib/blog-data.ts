export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  date: string
  readTime: string
  category: string
  img: string
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'atlantic-salmon-norway-guide',
    title: 'Atlantic Salmon in Norway: A Complete Guide for 2026',
    excerpt: 'Everything you need to know about planning your salmon fishing trip to the rivers of northern Norway — seasons, gear, and the best beats.',
    date: 'March 5, 2026',
    readTime: '8 min',
    category: 'Destinations',
    img: '/fish_catalog/salmon.jpg',
  },
  {
    slug: 'best-trout-rivers-sweden',
    title: 'The 5 Best Trout Rivers in Sweden Right Now',
    excerpt: 'From Dalälven to the crystal-clear streams of Jämtland — where to find the best wild trout fishing in Sweden this season.',
    date: 'February 28, 2026',
    readTime: '6 min',
    category: 'Sweden',
    img: '/fish_catalog/trout.jpg',
  },
  {
    slug: 'pike-fishing-beginners',
    title: 'Pike Fishing for Beginners: What Your Guide Wants You to Know',
    excerpt: 'Tips from experienced Scandinavian guides on gear, technique, and mindset before your first pike session.',
    date: 'February 18, 2026',
    readTime: '5 min',
    category: 'Tips & Tactics',
    img: '/fish_catalog/pike.jpg',
  },
  {
    slug: 'fishing-license-scandinavia',
    title: 'Fishing Licenses in Scandinavia: What Every Angler Needs',
    excerpt: 'A practical breakdown of licensing requirements in Norway, Sweden, and Finland for foreign visitors — so you can fish legally from day one.',
    date: 'February 10, 2026',
    readTime: '4 min',
    category: 'Planning',
    img: '/fish_catalog/zander.jpg',
  },
  {
    slug: 'grayling-season-2026',
    title: 'Grayling Season 2026: Best Windows and Where to Go',
    excerpt: 'The Arctic grayling is one of Scandinavia\'s most prized catches. Here\'s when and where to target them for maximum success.',
    date: 'January 30, 2026',
    readTime: '5 min',
    category: 'Species',
    img: '/fish_catalog/graling.jpeg',
  },
]
