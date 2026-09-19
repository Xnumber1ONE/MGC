module.exports = function (eleventyConfig) {
  const isProduction = process.env.ELEVENTY_ENV === "production";
  eleventyConfig.addGlobalData("baseUrl", isProduction ? "/MGC" : "");
  eleventyConfig.addFilter("date", function (dateObj) {
    if (!dateObj) return "";
    const d = new Date(dateObj);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  });

  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/js": "js" });
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });

  eleventyConfig.addFilter("coverUrl", (path, baseUrl) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    const base = baseUrl || "";
    if (path.startsWith("/")) return base + path;
    return base + "/" + path;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
    },
  };
};
