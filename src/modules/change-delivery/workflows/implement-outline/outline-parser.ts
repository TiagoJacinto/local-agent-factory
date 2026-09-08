import type { OutlinePhase } from "./request";

const phaseHeading = /^##\s+(?:✅\s+)?Phase\s+(\d+)\s*:\s*(.+?)\s*$/gim;

export function parseStructureOutline(source: string): readonly OutlinePhase[] {
  const headings = [...source.matchAll(phaseHeading)];
  if (headings.length === 0) throw new Error("structure outline contains no Phase headings");
  return headings.map((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? source.length;
    const body = source.slice(start, end).trim();
    const validationCommands = [
      ...body.matchAll(/^\s*(?:Validation|Run|Command)\s*:\s*`([^`]+)`\s*$/gim),
    ].map((match) => match[1].trim());
    const shellCommands = [...body.matchAll(/^\s*\$\s+(.+)$/gm)].map((match) => match[1].trim());
    const beforeCaptureCommand = body.match(/^\s*Before capture\s*:\s*`([^`]+)`\s*$/im)?.[1];
    const afterCaptureCommand = body.match(/^\s*After capture\s*:\s*`([^`]+)`\s*$/im)?.[1];
    const phaseNumber = Number(heading[1]);
    return {
      number: phaseNumber,
      title: heading[2].trim(),
      body,
      validationCommands: [...new Set([...validationCommands, ...shellCommands])],
      changesUi:
        /(?:changesUI|changes UI|user[- ]interface|UI)[^\n]*(?:yes|true|changed|update)/i.test(
          body,
        ),
      ...(beforeCaptureCommand ? { beforeCaptureCommand: beforeCaptureCommand.trim() } : {}),
      ...(afterCaptureCommand ? { afterCaptureCommand: afterCaptureCommand.trim() } : {}),
    };
  });
}
