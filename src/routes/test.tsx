import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { testServerFunction } from "@/lib/test.functions";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/test")({
  component: TestPage,
  head: () => ({ title: "Test Page" }),
});

function TestPage() {
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const testFn = useServerFn(testServerFunction);

  useEffect(() => {
    async function runTest() {
      try {
        const result = await testFn();
        console.log("Test result:", result);
        setTestResult(result);
      } catch (err) {
        console.error("Test error:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    runTest();
  }, [testFn]);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Test Page</h1>

      {loading && <p className="text-lg">Loading...</p>}
      
      {error && (
        <div className="p-4 bg-red-100 border border-red-300 rounded text-red-800 mb-4">
          Error: {error}
        </div>
      )}

      {testResult && (
        <div className="p-4 bg-green-100 border border-green-300 rounded text-green-800">
          <h2 className="font-semibold mb-2">Server Function Success!</h2>
          <pre className="whitespace-pre-wrap">{JSON.stringify(testResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
