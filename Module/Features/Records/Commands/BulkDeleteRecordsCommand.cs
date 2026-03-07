using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.Services;

namespace Module.Features.Records.Commands;

public record BulkDeleteRecordsCommand(int ModuleId, List<int> RecordIds) : ICommand;

public class BulkDeleteRecordsHandler : IRequestHandler<BulkDeleteRecordsCommand>
{
    private readonly AppDbContext _context;
    private readonly IRelationService _relationService;

    public BulkDeleteRecordsHandler(AppDbContext context, IRelationService relationService)
    {
        _context = context;
        _relationService = relationService;
    }

    public async Task Handle(BulkDeleteRecordsCommand request, CancellationToken cancellationToken)
    {
        var records = await _context.ModuleRecords
            .Include(r => r.Module)
            .Where(r => r.ModuleId == request.ModuleId && request.RecordIds.Contains(r.Id))
            .ToListAsync(cancellationToken);

        if (records.Count != request.RecordIds.Count)
        {
            var foundIds = records.Select(r => r.Id).ToList();
            var missingIds = request.RecordIds.Except(foundIds).ToList();
            throw new KeyNotFoundException($"Records with IDs [{string.Join(", ", missingIds)}] not found in module {request.ModuleId}.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            foreach (var record in records)
            {
                // Check for incoming relations (Referential Integrity)
                var hasIncomingRelations = await _context.RecordRelations
                    .AnyAsync(r => r.TargetModule == record.Module.Name && r.TargetRecordId == record.Id, cancellationToken);

                if (hasIncomingRelations)
                {
                    throw new InvalidOperationException($"Cannot delete record ID {record.Id} because it is referenced by other records.");
                }

                _context.ModuleRecords.Remove(record);
                await _context.SaveChangesAsync(cancellationToken);

                // Delete outgoing relations for source
                await _relationService.DeleteRelationsForSource(record.Module.Name, record.Id);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
