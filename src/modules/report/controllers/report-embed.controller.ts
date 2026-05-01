import {
    Controller,
    Get,
    Headers,
    Query,
    Res,
} from '@nestjs/common';
import { ReportService } from '../services/report.service';

@Controller('api/report-embed')
export class ReportEmbedController {
    constructor(private readonly reportService: ReportService) {}

    @Get('validate')
    validate(
        @Res() res: any,
        @Headers('x-forwarded-uri') forwardedUri?: string,
        @Query('embed_token') queryToken?: string,
    ) {
        const token = queryToken || this.extractTokenFromUri(forwardedUri);

        if (!token || !this.reportService.validateEmbedToken(token)) {
            return res.status(401).send('Invalid report embed token');
        }

        return res.status(204).send();
    }

    private extractTokenFromUri(uri?: string): string {
        if (!uri) return null;

        const match = uri.match(/^\/shiny-embed\/([^/]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    }
}
