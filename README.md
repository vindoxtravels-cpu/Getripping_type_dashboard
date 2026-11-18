# REA analysis output

This branch holds results from [REA](https://github.com/morluto/rea) investigations.
It is kept separate from `main`, which holds the Get Ripping dashboard.

## Layout

Each investigation gets its own folder:

```
<YYYY-MM-DD>-<target-name>/
  report.md        # findings, evidence and open questions
  evidence/        # REA Evidence JSON returned by the CLI or MCP tools
  decompiled/      # pseudocode and assembly for the functions examined
```

## What is not stored here

The binaries and apps being analyzed, Ghidra projects and other large
intermediate files are not committed. They are deleted from the local machine
after each push to save disk space.
