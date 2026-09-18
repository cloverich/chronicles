# Changelog

## Unreleased

- 2026-09-18 7ff7c36 Updated to Electron 44 with current Chromium and Node security fixes. <!-- commits: 7ff7c3651dc683281cf4bdbd2bd593f4120ee0d8 e57dbacbb6edadf7d32806cff9837dfc697f58e8 -->
- 2026-09-18 908fa1f Updated image processing (sharp 0.35) used when pasting or uploading images. <!-- commits: 908fa1f94b10a218cb64933503367f304cca6057 -->
- 2026-09-18 5c42e5d Added an in-app changelog view to Preferences and the welcome screen. <!-- commits: 5c42e5d7a2403d39ff2c0ec9d387d99ff9f755ca -->
- 2026-09-18 e8bf0d2 Added Archivo as a bundled font option in Preferences. <!-- commits: e8bf0d265b24bbbe1d927c18b82a113d05ddef21 -->
- 2026-09-16 6020222 Made journal names unique regardless of capitalization. <!-- commits: 6020222480ed008d3b8e4f60e601dbb542a7a961 -->
- 2026-09-16 052c3b2 Kept loading notifications attached to fast SQLite operations. <!-- commits: 052c3b2a59b96870566fe107aad13754f0f6256c -->
- 2026-09-15 f3dd738 Prevented imports from escaping their selected directory through matching path prefixes. <!-- commits: f3dd7381b840ad4aa12b68fff39ed9a9f1bcf060 -->
- 2026-09-14 77ad1b2 Added a maintenance action for resetting notes. <!-- commits: 77ad1b2cb415ca7fec8bd4726014872ec549fc07 -->
- 2026-09-14 9ddc475 Added verified SQLite database backups. <!-- commits: 9ddc475973b52f390f619f0103402c4a7b324e23 -->
- 2026-09-14 54c9d4d Added Markdown-tree export with referenced attachments. <!-- commits: 54c9d4db790dd738ef241745e5000fc06892ed65 -->
- 2026-09-14 42334e3 Added import for Chronicles Markdown trees. <!-- commits: 42334e354bf75c331c52524243849f643c403ce9 -->
- 2026-09-14 d884b52 Made SQLite the source of truth for note content and journals. <!-- commits: d884b5220e7957eadd99aee5ba6c07dd6f2fe2c7 90dad1a505566e75e811bf90fae0279a802019ac cf53a7b31c44fa5f710490d081afdda710f78402 85f635c31822bf5335cfab9d624a6e9b384cf452 -->
- 2026-07-14 acfe4ba Restored Control-E end-of-line behavior on macOS. <!-- commits: acfe4bab0149210b0e4bf53dc04ccf040155a4ca -->
- 2026-07-13 372c9bf Removed the old Markdown file after moving a note to another journal. <!-- commits: 372c9bf6af60e3acedc5816ace8c6abab2bbd7d5 -->
- 2026-04-05 5804ba6 Updated the date picker and aligned it with application themes. <!-- commits: 5804ba6df240bf949e9f9385d8871c05dab03616 -->
- 2026-04-04 49b0e24 Restored note deletion to every document menu. <!-- commits: 49b0e240accb9f23f36558866d7e0a1c9bb2900a -->
- 2026-04-04 6edfe52 Added GFM checklists to the Lexical editor. <!-- commits: 6edfe521c151bd6bfbe0cdaca91270a56fdf2830 -->
- 2026-03-25 f595663 Preserved decoded HTML entities through Lexical Markdown imports. <!-- commits: f59566376b0ff444b9756f70d86503a88bc2dd77 -->
- 2026-03-25 2c86d5b Tightened spacing in the Lexical editor. <!-- commits: 2c86d5be59f9bdf3cf07d46589df116b70984272 -->
- 2026-03-25 53d07f2 Prevented scrollbar bounce and improved note-link filtering. <!-- commits: 53d07f224b63d56fc88ecd902cbbdd45be568ef0 -->
- 2026-03-25 eba40b7 Polished theming, Lexical styling, and code-block language selection. <!-- commits: eba40b74b56aebd31f85d6fa3a756c0be52467e6 -->
- 2026-03-24 356bb20 Detected duplicate document IDs across journals. <!-- commits: 356bb204b9ea575e1d4f9558711c2aed1a763064 -->
- 2026-03-22 72f8f20 Moved the local MCP server into the Electron app. <!-- commits: 72f8f20e5e90a9d2d1aff0ffb40a230c16b828c0 -->
- 2026-03-21 ce3bcb4 Made Lexical the default editor and modernized the Electron backend. <!-- commits: ce3bcb43e516c41d6233fea949d5b9b83d5f1399 -->
- 2026-03-20 09d9967 Preserved Lexical image Markdown and rendered relative image paths. <!-- commits: 09d99674eb42850840f0a4bd64ceb71b944e63e1 -->
- 2026-03-14 f5590df Improved note-link suggestion truncation and default recency ordering. <!-- commits: f5590df2ab950e321c3d8a089c825df43b568b1e -->
- 2026-03-12 869b254 Added the Ariake Dark theme and theme-management improvements. <!-- commits: 869b25486064723326137ccce8ccf1a296dcde88 -->
- 2026-03-10 a114068 Followed system dark mode reliably and removed duplicate theme choices. <!-- commits: a1140682d88263feea04358d73d1d1d5fdc29211 -->
- 2026-03-10 06c1b7c Added Warm Paper and Neofloss bundled themes. <!-- commits: 06c1b7c02ef3c8ee4bb5b944025502bd86078d81 -->
- 2026-03-09 132ebba Cached custom fonts for faster, more reliable loading. <!-- commits: 132ebbaae85f6dcc3df64f8c710f57cfbd625648 -->
- 2026-03-07 afdc797 Added a one-click reset for appearance settings. <!-- commits: afdc797310601181dfca56e33fc1fef045d97979 -->
- 2026-03-07 e756f5c Refined search results, note-link search, and preferences. <!-- commits: e756f5c0fed30edac3743c6cd80513cec31b456c -->
- 2026-03-06 58e1f94 Added installable custom themes and corrected theme token behavior. <!-- commits: 6963099a60bb410653fe87cba8e80d36a73870f9 58e1f945b454df680cc9318a11b52e60cec07261 -->
- 2026-03-06 61f9215 Added selectable light and dark code syntax themes. <!-- commits: ae6dd2db2775352003683930417fad53e8a7073f 61f92152f53a4dbd8305e07f8a63d460a07b2d18 89c5f4bd4baddbcd195a315ac3efc556d272b5eb -->
- 2026-03-04 d9193fe Applied configured font sizes to lists and code blocks. <!-- commits: d9193fe697b827ec3c5952ee33f854c308cf54cc 3e7c36bacaa1143e32883d42141048e16b199426 -->
- 2026-03-03 e10f8df Added theme storage and preference controls. <!-- commits: e10f8dfff711c09d04a4a3c6dbaa05ec7c9f9c30 03a0bfb0b3e852afcc387eefabe478d8f2c28b16 05bf3a11303a51b2d10c54cdac8ed414a93950c4 -->

## 0.12.1 — 2026-03-02

- 2026-03-02 9926ad2 Made editor and interface font sizes configurable. <!-- commits: 9926ad2cb12e55de445f3d693469de8fa5c7fc35 -->
- 2026-03-02 5195425 Completed date-query search and made matching text more compact. <!-- commits: 5195425062d2c022fe8aaa537557f6c18aed08d2 -->
- 2026-03-02 2519f40 Added a toggle to search suggestions and stopped them opening unexpectedly. <!-- commits: 2519f403dbd61977922900cf925b0157ebd34073 -->
- 2026-03-02 e3de053 Increased content density while preserving useful element spacing. <!-- commits: e3de0534e28a6efbb248995c323a6030d4b4d266 -->

<!-- changelog-cursor: 5c42e5d7a2403d39ff2c0ec9d387d99ff9f755ca -->
