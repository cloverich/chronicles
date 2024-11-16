# A testable document

This is based on an actual document I had, which had a bunch of links and other weird things
that were failing to parse as expected. I worked through and now its a good place to document
some of these. It can be extended _as needed_ as a high level / snapshot and testing ground
for various issues. Some of the original text is left as is, some I've modified as needed.

- Read though the organized Systems Design resources
- Re-write each of the questions I was asked, with tests, in Python

## Recap

Here are some links to actual documents, the way they existed in my Notion export:

[Interview Coding Problems I saw](../Documents/01931c56fd8775bea2b1125dca4028b5.md)

[Interviewing in 2022 - a verbose and unworthy recap](../Documents/01931c56fd9675e7911a5de7429295ec.md)

# Topics

[](Jobs%20Search%202022%2087ddab10364d4332bdb83cc0ba9a9204/Jobs%20list%205302084b0c3e47108cc999b2552bcf1a.md)

[Behavioral Interview Prep](../research/01931c56fc2378079233d986767c519c.md)

[Resume Deep Dive and Behavioral Questions Q\&A](../research/01931c56ff38755ca829d73b74a150a7.md)

Here is a typical note. It has a paragraph and a [reference link][1]. I hope it works!

...Let me also check this image:
![alt text](https://example.com)

The end. Oh, without a definition for the reference link, it won't interpret
the reference link above as a linkReference. So here it is.

# Random Link issues

This link should roundtrip as is: <https://topstartups.io/>. It appears to also be the _preferred_ method when there is a title-less link.

You could alter this behavior (and others) like so:

```ts
return toMarkdown(tree, {
  extensions: [gfmToMarkdown() as any],
  bullet: "-",
  emphasis: "_",

  handlers: {
    link: (node) => {
      return `[${node.children?.[0]?.value || ""}](${node.url})`;
    },
  },
});
```

But after [some research](https://github.com/syntax-tree/mdast-util-to-markdown/issues/8), I see its best to try and let the tool do its thing, especialy since I do not typically expose this markdown to end users.

[Work at a Startup](https://www.workatastartup.com/companies?companySize=any\&demographic=any\&expo=any\&industry=any\&jobType=any\&layout=list-compact\&remote=any\&role=matching\&sortBy=created_desc)

[1]: https://example2.com
