export const formatSize = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    const sign = bytes < 0 ? "-" : "";
    const absoluteBytes = Math.abs(bytes);
    const unitIndex = Math.min(
        Math.floor(Math.log(absoluteBytes) / Math.log(1024)),
        units.length - 1
    );
    const size = absoluteBytes / 1024 ** unitIndex;
    const decimals = unitIndex === 0 || size >= 10 ? 0 : 1;
    const value = Number(size.toFixed(decimals));

    return `${sign}${value} ${units[unitIndex]}`;
};

export const generateUUID = () => crypto.randomUUID();
