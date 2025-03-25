# Teams AI Accelerator Gallery

A template gallery showcasing AI-powered Teams applications built by the Teams AI Accelerator Group.

![Template Gallery](assets/gallery-example.png)

## Overview

This gallery is built with:

- [Next.js 15](https://nextjs.org/) (Static Export)
- [React 8](https://react.dev/)
- [Fluent UI](https://react.fluentui.dev/)
- [Node.js 20](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

The gallery provides a curated collection of Teams app templates that developers can use as starting points for building their own AI-powered Teams applications. Each template includes:

- Source code and documentation
- Live demo
- Implementation details
- Key features
- Setup instructions

## Features

- 🎨 Modern, responsive UI built with Fluent UI components
- 🌗 Light/dark theme support
- 📱 Mobile-friendly design
- 📖 Detailed template documentation
- 🚀 Link to Github project

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Production

### Build

To create static export build to `out/` folder, run:

```
pnpm next build
```

> Next.js [static export](https://nextjs.org/docs/pages/building-your-application/deploying/static-exports) builds the
> application into HTML, CSS, JS, and static assets that can be deployed as a static page. Hence features like
> Server-side rendering, Dynamic routes, and many more do not work. The local development server support these features
> and so it is possible to introduce code changes that work locally but will failed on static export build.

### Testing in Github Pages

First create a fork of this repo. Then enable Github Actions and Github Pages. Run the `Deploy Next.js site to Pages` workflow to deploy to Github Pages. Once testing is done in your forked repository, you can create a PR to merge it into the source repository.  

## Other commands

### Linter

```
pnpm lint
```

### Format using Prettier

```
pnpm format
```

## Templates

Templates in the gallery are loaded from the `public/data/templates.yaml` file.

## Appendix

### Caveats

- When using `Image` component, make sure the prefix the `src` with the `basePath` from `next.config.ts` so that the images are served from the correct path.

  ```tsx
  import config from 'path/to/next.config';

  <Image src={`${config.basePath}/next.svg`} />;
  ```

- The following issue occurs when using the `FluentProvider` for which there's a hacky solution. However it is not affecting the production static build nor the performance of the site. Hence we're ignoring it for now. It will show up as a console error in the dev environment though.

  ```
  @fluentui/react-provider: There are conflicting ids in your DOM. Please make sure that you configured your application properly.

  Configuration guide: https://aka.ms/fluentui-conflicting-ids
  ```
