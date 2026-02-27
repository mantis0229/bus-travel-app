exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  const KAKAO_KEY = "786a0d72bee0975417b6cddb2c8a812b";
  const ODSAY_KEY = "gjp7wYpNUORJ20ay5NNFww";

  try {
    const { origin, destination } = JSON.parse(event.body);

    // 카카오로 정류장 좌표 검색
    const searchCoord = async (name) => {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(name + " 광주 버스정류장")}&size=1&category_group_code=BUS_STOP`,
        { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } }
      );
      const data = await res.json();
      if (data.documents && data.documents.length > 0) {
        return { x: parseFloat(data.documents[0].x), y: parseFloat(data.documents[0].y) };
      }
      return null;
    };

    const [originCoord, destCoord] = await Promise.all([
      searchCoord(origin),
      searchCoord(destination)
    ]);

    if (!originCoord || !destCoord) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "좌표를 찾을 수 없어요" })
      };
    }

    // ODsay 대중교통 경로 검색
    const odsayRes = await fetch(
      `https://api.odsay.com/v1/api/searchPubTransPathT?SX=${originCoord.x}&SY=${originCoord.y}&EX=${destCoord.x}&EY=${destCoord.y}&apiKey=${ODSAY_KEY}`
    );
    const odsayData = await odsayRes.json();

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ odsayData, originCoord, destCoord })
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message })
    };
  }
};